import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getTeamRank } from '@/lib/rankings';

export async function GET() {
    try {
        const ODDS_API_KEY = process.env.ODDS_API_KEY;
        if (!ODDS_API_KEY) {
            return NextResponse.json({ error: 'ODDS_API_KEY is not configured.' }, { status: 500 });
        }

        // 1. Fetch from The Odds API
        // Sports key: basketball_ncaab
        // Markets: spreads
        // Regions: us
        const response = await fetch(`https://api.the-odds-api.com/v4/sports/basketball_ncaab/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads,h2h,totals`, {
            next: { revalidate: 0 } // no cache for cron
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Odds API Error:", errorText);
            return NextResponse.json({ error: 'Failed to fetch from Odds API', details: errorText }, { status: response.status });
        }

        const data = await response.json();
        const supabase = await createClient();

        let gamesInserted = 0;
        let oddsInserted = 0;

        console.log(`Fetched ${data.length} games from The Odds API`);

        // 2. Transform and Upsert to Supabase
        for (const game of data) {
            // 2a. Upsert Game Table
            // Use game.id from Odds API as external_id
            const teamsString = `${game.away_team} @ ${game.home_team}`;



            // 2b. Extract Spread and ML
            const bookmakers = game.bookmakers;
            if (!bookmakers || bookmakers.length === 0) continue;

            const primaryBookmaker = bookmakers.find((b: { key: string }) => b.key === 'pinnacle') || bookmakers[0];
            const spreadMarket = primaryBookmaker.markets.find((m: { key: string }) => m.key === 'spreads');
            if (!spreadMarket || !spreadMarket.outcomes || spreadMarket.outcomes.length === 0) continue;

            const homeOutcome = spreadMarket.outcomes.find((o: { name: string }) => o.name === game.home_team);
            if (!homeOutcome) continue;

            const currentSpread = homeOutcome.point;
            const spreadPrice = homeOutcome.price;

            // 2c. Calculate Sharp Signal Side and Confidence Score
            let signalSide: string | null = null;
            let confidenceScore = 50;

            // Get opening line if exists, otherwise use current
            const openingSpread = game.odds_snapshots?.[0]?.spread ?? currentSpread;
            const spreadDelta = currentSpread - openingSpread;

            if (Math.abs(spreadDelta) >= 1.0) {
                // Determine Sharp Side (opposite of public)
                if (currentSpread < 0) {
                    signalSide = spreadDelta > 0 ? 'away' : 'home';
                } else {
                    signalSide = spreadDelta > 0 ? 'home' : 'away';
                }

                // Initial Confidence Formula
                confidenceScore += Math.floor(Math.abs(spreadDelta) * 15);
                if (getTeamRank(game.home_team) || getTeamRank(game.away_team)) confidenceScore += 10;
            }

            const { data: gameRecord, error: gameError } = await supabase
                .from('games')
                .upsert({
                    external_id: game.id,
                    teams: teamsString,
                    commence_time: game.commence_time,
                    home_rank: getTeamRank(game.home_team),
                    away_rank: getTeamRank(game.away_team),
                    signal_side: signalSide,
                    confidence_score: Math.min(99, confidenceScore),
                    closing_spread: currentSpread
                }, { onConflict: 'external_id' })
                .select('id')
                .single();

            if (gameError || !gameRecord) {
                console.error(`Error upserting game ${game.id}:`, gameError?.message || 'No record returned');
                continue;
            }
            gamesInserted++;

            // Extract moneyline (h2h market)
            const h2hMarket = primaryBookmaker.markets.find((m: { key: string }) => m.key === 'h2h');
            let mlHome: number | null = null;
            let mlAway: number | null = null;
            if (h2hMarket?.outcomes) {
                const mlHomeOutcome = h2hMarket.outcomes.find((o: { name: string }) => o.name === game.home_team);
                const mlAwayOutcome = h2hMarket.outcomes.find((o: { name: string }) => o.name === game.away_team);
                mlHome = mlHomeOutcome?.price ?? null;
                mlAway = mlAwayOutcome?.price ?? null;
            }

            // Extract totals (over/under)
            const totalsMarket = primaryBookmaker.markets.find((m: { key: string }) => m.key === 'totals');
            let totalPoints: number | null = null;
            let overPrice: number | null = null;
            let underPrice: number | null = null;
            if (totalsMarket?.outcomes) {
                const overOutcome = totalsMarket.outcomes.find((o: { name: string }) => o.name === 'Over');
                const underOutcome = totalsMarket.outcomes.find((o: { name: string }) => o.name === 'Under');
                totalPoints = overOutcome?.point ?? null;
                overPrice = overOutcome?.price ?? null;
                underPrice = underOutcome?.price ?? null;
            }

            // Check if this is the FIRST snapshot for this game
            const { count } = await supabase
                .from('odds_snapshots')
                .select('*', { count: 'exact', head: true })
                .eq('game_id', gameRecord.id);

            const isOpeningLine = count === 0;

            const { error: oddsError } = await supabase
                .from('odds_snapshots')
                .insert({
                    game_id: gameRecord.id,
                    bookmaker: primaryBookmaker.title,
                    spread: currentSpread,
                    spread_price: spreadPrice,
                    moneyline_home: mlHome,
                    moneyline_away: mlAway,
                    total_points: totalPoints,
                    over_price: overPrice,
                    under_price: underPrice,
                    is_opening_line: isOpeningLine
                });

            if (oddsError) {
                console.error("Error inserting odds snapshot:", oddsError);
            } else {
                oddsInserted++;
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Odds successfully fetched and updated in database.',
            stats: { gamesProcessed: gamesInserted, oddsSnapshotsInserted: oddsInserted }
        });

    } catch (error: unknown) {
        console.error("CRITICAL API ERROR:", error);
        return NextResponse.json({ error: 'Internal Server Error', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}
