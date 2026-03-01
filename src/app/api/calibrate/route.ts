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
            .select('confidence_score, result_win, game_status')
            .eq('game_status', 'final')
            .not('result_win', 'is', null);

        if (gamesError) throw gamesError;

        // 2. Aggregate performance in-code (fallback for missing SQL view)
        const strongSignals = games.filter(g => g.confidence_score >= 80);
        const totalStrongSignals = strongSignals.length;
        const totalStrongWins = strongSignals.filter(g => g.result_win === true).length;
        const avgStrongWinRate = totalStrongSignals > 0 ? totalStrongWins / totalStrongSignals : 0;

        let adjustment = 0;
        let message = "Weights are optimal.";

        if (totalStrongSignals >= 5) { // Only adjust if we have a decent sample size
            if (avgStrongWinRate < 0.50) {
                adjustment = -1.0; // Decrease multiplier (be stricter) - Larger jump for first learning
                message = `Strong bets underperforming (${(avgStrongWinRate * 100).toFixed(1)}%). Tightening filters.`;
            } else if (avgStrongWinRate > 0.60) {
                adjustment = 0.5; // Increase multiplier (be more inclusive)
                message = `Strong bets overperforming (${(avgStrongWinRate * 100).toFixed(1)}%). Loosening filters.`;
            }
        } else {
            message = "Insufficient data for calibration. Need at least 5 completed strong signals.";
        }

        if (adjustment !== 0) {
            // Update the spread_multiplier in the database
            const { data: currentWeight, error: weightError } = await supabase
                .from('signal_weights')
                .select('weight')
                .eq('category', 'spread_multiplier')
                .maybeSingle();

            const current = currentWeight?.weight || 10;
            const newWeight = Math.max(5, Math.min(20, current + adjustment));

            if (weightError || !currentWeight) {
                // Upsert if not exists
                await supabase.from('signal_weights').upsert({
                    category: 'spread_multiplier',
                    weight: newWeight,
                    last_tuned: new Date().toISOString()
                }, { onConflict: 'category' });
            } else {
                await supabase
                    .from('signal_weights')
                    .update({ weight: newWeight, last_tuned: new Date().toISOString() })
                    .eq('category', 'spread_multiplier');
            }
        }

        return NextResponse.json({
            success: true,
            message,
            stats: {
                avgStrongWinRate,
                totalStrongSignals,
                adjustmentMade: adjustment
            }
        });

    } catch (error: any) {
        console.error("Calibration Error:", error);
        return NextResponse.json({ error: 'Calibration Fail', details: error.message }, { status: 500 });
    }
}
