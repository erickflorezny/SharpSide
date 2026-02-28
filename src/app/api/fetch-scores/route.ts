import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * Fetch live scores from ESPN's free public API (no API key needed).
 * This saves Odds API credits by using a separate free source for scores.
 */
export async function GET() {
    try {
        const supabase = await createClient();

        // ESPN NCAAB Scoreboard — free, no API key required
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

            // Determine game status
            const statusType = event.status?.type?.name; // 'STATUS_SCHEDULED', 'STATUS_IN_PROGRESS', 'STATUS_FINAL'
            let gameStatus = 'upcoming';
            if (statusType === 'STATUS_FINAL' || statusType === 'STATUS_FINAL_OT') {
                gameStatus = 'final';
            } else if (statusType === 'STATUS_IN_PROGRESS' || statusType === 'STATUS_HALFTIME' || statusType === 'STATUS_END_PERIOD') {
                gameStatus = 'live';
            }

            // Only update games that are live or final
            if (gameStatus === 'upcoming') continue;

            // Match by team names in the "teams" column (format: "Away @ Home")
            // Use ILIKE for flexible matching
            const matchPattern = `%${awayName}%${homeName}%`;
            const { error } = await supabase
                .from('games')
                .update({
                    home_score: homeScore,
                    away_score: awayScore,
                    game_status: gameStatus,
                    last_score_update: new Date().toISOString(),
                })
                .ilike('teams', matchPattern);

            if (!error) updated++;
        }

        return NextResponse.json({
            success: true,
            message: `Scores updated from ESPN. ${updated} games matched.`,
            totalEvents: events.length,
            scoresUpdated: updated,
        });
    } catch (error: unknown) {
        console.error('ESPN Scores Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
