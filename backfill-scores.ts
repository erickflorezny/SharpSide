import { createClient } from '@supabase/supabase-js';

async function backfill() {
    console.log('Starting backfill of confidence scores...');

    const supabaseUrl = 'https://vlpycpmgdzeeqeerhlgh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZscHljcG1nZHplZXFlZXJobGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMzM0MTksImV4cCI6MjA4NzgwOTQxOX0.6pNnXk9bzbe9_DNsq6BDo1JBpmqiSNrMGbUwZJRYKVM';

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch games from the last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: games, error: gamesError } = await supabase
        .from('games')
        .select('id, teams, home_rank, away_rank')
        .gte('commence_time', yesterday);

    if (gamesError) {
        console.error('Error fetching games:', gamesError);
        return;
    }

    console.log(`Found ${games.length} games to process.`);

    for (const game of games) {
        // 2. Fetch snapshots for this game
        const { data: snapshots, error: snapError } = await supabase
            .from('odds_snapshots')
            .select('spread, is_opening_line, timestamp')
            .eq('game_id', game.id)
            .order('timestamp', { ascending: true });

        if (snapError || !snapshots || snapshots.length < 2) {
            console.log(`Skipping ${game.teams}: Insufficient snapshots.`);
            continue;
        }

        const openingSnapshot = snapshots.find(s => s.is_opening_line) || snapshots[0];
        const currentSnapshot = snapshots[snapshots.length - 1];

        const openingSpread = openingSnapshot.spread;
        const currentSpread = currentSnapshot.spread;
        const spreadDelta = currentSpread - openingSpread;

        if (Math.abs(spreadDelta) >= 1.0) {
            let signalSide: string | null = null;
            let confidenceScore = 50;

            // Determine Sharp Side (opposite of public)
            if (currentSpread < 0) {
                signalSide = spreadDelta > 0 ? 'away' : 'home';
            } else {
                signalSide = spreadDelta > 0 ? 'home' : 'away';
            }

            // Confidence Formula
            confidenceScore += Math.floor(Math.abs(spreadDelta) * 15);
            if ((game.home_rank && game.home_rank <= 25) || (game.away_rank && game.away_rank <= 25)) {
                confidenceScore += 10;
            }

            const finalConfidence = Math.min(99, confidenceScore);

            console.log(`Updating ${game.teams}: Side=${signalSide}, Score=${finalConfidence}, Delta=${spreadDelta.toFixed(1)}`);

            const { error: updateError } = await supabase
                .from('games')
                .update({
                    signal_side: signalSide,
                    confidence_score: finalConfidence,
                    closing_spread: currentSpread
                })
                .eq('id', game.id);

            if (updateError) {
                console.error(`Error updating ${game.id}:`, updateError);
            }
        } else {
            console.log(`Skipping ${game.teams}: Low movement (${spreadDelta.toFixed(1)})`);
        }
    }

    console.log('Backfill complete!');
}

backfill();
