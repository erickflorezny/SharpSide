import { createClient } from '@supabase/supabase-js';

async function backfill() {
    console.log('Starting refined backfill (10x multiplier)...');

    const supabaseUrl = 'https://vlpycpmgdzeeqeerhlgh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZscHljcG1nZHplZXFlZXJobGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMzM0MTksImV4cCI6MjA4NzgwOTQxOX0.6pNnXk9bzbe9_DNsq6BDo1JBpmqiSNrMGbUwZJRYKVM';

    const supabase = createClient(supabaseUrl, supabaseKey);

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: games } = await supabase
        .from('games')
        .select('id, teams, home_rank, away_rank')
        .gte('commence_time', yesterday);

    if (!games) return;

    for (const game of games) {
        const { data: snapshots } = await supabase
            .from('odds_snapshots')
            .select('spread, is_opening_line, timestamp')
            .eq('game_id', game.id)
            .order('timestamp', { ascending: true });

        if (!snapshots || snapshots.length < 2) continue;

        const opening = snapshots.find(s => s.is_opening_line) || snapshots[0];
        const current = snapshots[snapshots.length - 1];
        const delta = current.spread - opening.spread;

        if (Math.abs(delta) >= 1.0) {
            let side: string | null = null;
            if (current.spread < 0) {
                side = delta > 0 ? 'away' : 'home';
            } else {
                side = delta > 0 ? 'home' : 'away';
            }

            let score = 50;
            score += Math.floor(Math.abs(delta) * 10); // REFINED MULTIPLIER
            if ((game.home_rank && game.home_rank <= 25) || (game.away_rank && game.away_rank <= 25)) {
                score += 10;
            }

            await supabase.from('games').update({
                signal_side: side,
                confidence_score: Math.min(98, score),
                closing_spread: current.spread
            }).eq('id', game.id);
        }
    }
    console.log('Refined backfill complete.');
}

backfill();
