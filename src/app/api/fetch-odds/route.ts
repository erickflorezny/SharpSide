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

            const { data: gameRecord, error: gameError } = await supabase
                .from('games')
                .upsert({
                    external_id: game.id,
                    teams: teamsString,
                    commence_time: game.commence_time,
                    home_rank: getTeamRank(game.home_team),
                    away_rank: getTeamRank(game.away_team),
                }, { onConflict: 'external_id' })
                .select('id')
                .single();

            if (gameError || !gameRecord) {
                console.error(`Error upserting game ${game.id}:`, gameError?.message || 'No record returned');
                continue;
            }
            gamesInserted++;

            // 2b. Insert Odds Snapshots
            // Look for the main bookmakers (e.g., DraftKings, FanDuel, Pinnacle (sharp))
            // For this scaffold, we'll take the first available bookmaker's spread to simplify.

            const bookmakers = game.bookmakers;
            if (!bookmakers || bookmakers.length === 0) continue;

            // Prefer pinnacle if available, otherwise take the first
            const primaryBookmaker = bookmakers.find((b: { key: string }) => b.key === 'pinnacle') || bookmakers[0];

            const spreadMarket = primaryBookmaker.markets.find((m: { key: string }) => m.key === 'spreads');
            if (!spreadMarket || !spreadMarket.outcomes || spreadMarket.outcomes.length === 0) continue;

            // Find the spread for the home team (usually negative if favorite)
            const homeOutcome = spreadMarket.outcomes.find((o: { name: string }) => o.name === game.home_team);
            if (!homeOutcome) continue;

            const currentSpread = homeOutcome.point;
            const spreadPrice = homeOutcome.price; // juice/vig

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

        // 3. Fetch scores for live and recently completed games
        let scoresUpdated = 0;
        try {
            const scoresResponse = await fetch(
                `https://api.the-odds-api.com/v4/sports/basketball_ncaab/scores/?apiKey=${ODDS_API_KEY}&daysFrom=1`,
                { next: { revalidate: 0 } }
            );

            if (scoresResponse.ok) {
                const scoresData = await scoresResponse.json();
                for (const scoreGame of scoresData) {
                    if (!scoreGame.scores || scoreGame.scores.length === 0) continue;

                    const homeScore = scoreGame.scores.find((s: { name: string }) => s.name === scoreGame.home_team);
                    const awayScore = scoreGame.scores.find((s: { name: string }) => s.name === scoreGame.away_team);

                    let gameStatus = 'upcoming';
                    if (scoreGame.completed) {
                        gameStatus = 'final';
                    } else if (scoreGame.scores && scoreGame.scores.length > 0) {
                        gameStatus = 'live';
                    }

                    const { error: scoreError } = await supabase
                        .from('games')
                        .update({
                            home_score: homeScore ? parseInt(homeScore.score) : null,
                            away_score: awayScore ? parseInt(awayScore.score) : null,
                            game_status: gameStatus,
                            last_score_update: new Date().toISOString(),
                        })
                        .eq('external_id', scoreGame.id);

                    if (!scoreError) scoresUpdated++;
                }
            }
        } catch (scoreErr) {
            console.error('Scores fetch error:', scoreErr);
        }

        return NextResponse.json({
            success: true,
            message: 'Odds and scores successfully fetched and updated.',
            stats: { gamesProcessed: gamesInserted, oddsSnapshotsInserted: oddsInserted, scoresUpdated }
        });

    } catch (error: unknown) {
        console.error("CRITICAL API ERROR:", error);
        return NextResponse.json({ error: 'Internal Server Error', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}
