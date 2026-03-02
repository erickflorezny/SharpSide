import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * The Calibration Engine: 
 * Analyzes past signal performance and updates the formula weights.
 */
export async function GET() {
    try {
        const supabase = await createClient();

        // 1. Fetch all games with results
        const { data: games, error: gamesError } = await supabase
            .from('games')
            .select('confidence_score, result_win, game_status, home_rank, away_rank')
            .eq('game_status', 'final')
            .not('result_win', 'is', null);

        if (gamesError) throw gamesError;

        // 2. Fragment analysis: Ranked vs Unranked
        const strongSignals = games.filter(g => g.confidence_score >= 80);
        const rankedStrong = strongSignals.filter(g => (g.home_rank && g.home_rank <= 25) || (g.away_rank && g.away_rank <= 25));
        const unrankedStrong = strongSignals.filter(g => !((g.home_rank && g.home_rank <= 25) || (g.away_rank && g.away_rank <= 25)));

        const calcAccuracy = (list: any[]) => {
            if (list.length === 0) return 0;
            return list.filter(g => g.result_win === true).length / list.length;
        };

        const overallWinRate = calcAccuracy(strongSignals);
        const rankedWinRate = calcAccuracy(rankedStrong);
        const unrankedWinRate = calcAccuracy(unrankedStrong);

        let adjustments: { category: string, delta: number }[] = [];

        // TIGHTER CALIBRATION: Target > 60% win rate for "Strong" label
        // If ranked is failing, be much stricter with Top 25 bonus
        if (rankedStrong.length >= 3) {
            if (rankedWinRate < 0.60) {
                adjustments.push({ category: 'top_25_bonus', delta: -1.5 });
            } else if (rankedWinRate > 0.75) {
                adjustments.push({ category: 'top_25_bonus', delta: 0.5 });
            }
        }

        // Generic spread multiplier adjustment
        if (strongSignals.length >= 5) {
            if (overallWinRate < 0.55) {
                adjustments.push({ category: 'spread_multiplier', delta: -1.0 });
            } else if (overallWinRate > 0.65) {
                adjustments.push({ category: 'spread_multiplier', delta: 0.5 });
            }
        }

        // 3. Apply Adjustments
        for (const adj of adjustments) {
            const { data: weightRecord } = await supabase
                .from('signal_weights')
                .select('weight')
                .eq('category', adj.category)
                .maybeSingle();

            const current = weightRecord?.weight || (adj.category === 'top_25_bonus' ? 10 : 10);
            const newWeight = Math.max(2, Math.min(25, current + adj.delta));

            await supabase.from('signal_weights').upsert({
                category: adj.category,
                weight: newWeight,
                last_tuned: new Date().toISOString()
            }, { onConflict: 'category' });
        }

        return NextResponse.json({
            success: true,
            message: adjustments.length > 0 ? `Tuned ${adjustments.length} weights.` : "Weights stable.",
            stats: {
                overallWinRate: Math.round(overallWinRate * 100),
                rankedWinRate: Math.round(rankedWinRate * 100),
                totalSignals: strongSignals.length,
                adjustmentsMade: adjustments.length
            }
        });

    } catch (error: unknown) {
        console.error("Calibration Error:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Calibration Fail', details: errorMessage }, { status: 500 });
    }
}
