import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * Fetch live scores from ESPN's free public API.
 */
export async function GET() {
    try {
        const supabase = await createClient();

        const response = await fetch(
            'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
            { next: { revalidate: 0 } }
        );

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch from ESPN' }, { status: response.status });
        }

        const data = await response.json();
        const events = data.events || [];
        let updated = 0;

        for (const event of events) {
            const competition = event.competitions?.[0];
            if (!competition) continue;

            const competitors = competition.competitors || [];
            const homeTeam = competitors.find((c: any) => c.homeAway === 'home');
            const awayTeam = competitors.find((c: any) => c.homeAway === 'away');
            if (!homeTeam || !awayTeam) continue;

            const homeScore = parseInt(homeTeam.score) || 0;
            const awayScore = parseInt(awayTeam.score) || 0;
            const homeName = homeTeam.team?.displayName || '';
            const awayName = awayTeam.team?.displayName || '';

            // Status: 'STATUS_SCHEDULED', 'STATUS_IN_PROGRESS', 'STATUS_FINAL', 'STATUS_FINAL_OT', 'STATUS_HALFTIME'
            const statusType = event.status?.type?.name;
            let gameStatus = 'upcoming';
            if (statusType.includes('FINAL')) {
                gameStatus = 'final';
            } else if (statusType.includes('PROGRESS') || statusType.includes('HALFTIME') || statusType.includes('PERIOD')) {
                gameStatus = 'live';
            }

            // Only update games that have a score (live or final)
            if (gameStatus === 'upcoming') continue;

            // Improved matching: Use primary names and tokens
            // "Virginia Cavaliers" -> ["Virginia", "Cavaliers"]
            // We search for both names in the "teams" string
            const awayTokens = awayName.split(' ');
            const homeTokens = homeName.split(' ');

            // Try matching with the first word (usually the city/school name)
            const awaySearch = awayTokens[0];
            const homeSearch = homeTokens[0];

            const { data: matchedGames } = await supabase
                .from('games')
                .select('id, signal_side, closing_spread, teams')
                .or(`teams.ilike.%${awaySearch}%${homeSearch}%,teams.ilike.%${awayName}%${homeName}%`)
                .limit(1);

            const gameRecord = matchedGames?.[0];
            if (!gameRecord) continue;

            let resultWin: boolean | null = null;
            if (gameStatus === 'final' && gameRecord.signal_side && gameRecord.closing_spread !== null) {
                // Adjust score by spread (CLOSING spread)
                // If Bovada says -5, homeFinal = score - 5.
                const homeAdjusted = homeScore + gameRecord.closing_spread;
                if (gameRecord.signal_side === 'home') {
                    resultWin = homeAdjusted > awayScore;
                } else {
                    resultWin = awayScore > homeAdjusted;
                }
            }

            const { error } = await supabase
                .from('games')
                .update({
                    home_score: homeScore,
                    away_score: awayScore,
                    game_status: gameStatus,
                    last_score_update: new Date().toISOString(),
                    result_win: resultWin
                })
                .eq('id', gameRecord.id);

            if (!error) updated++;
        }

        return NextResponse.json({
            success: true,
            message: `Scores updated. ${updated} matched.`,
            totalEvents: events.length,
            scoresUpdated: updated,
        });
    } catch (error: unknown) {
        console.error('ESPN Scores Error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
