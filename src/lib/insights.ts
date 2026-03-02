import { SharpSignalGame } from '@/actions/getSharpSignals';

/**
 * Generate contextual game insights from existing data.
 * Returns an array of insight strings with emoji prefixes.
 */
export function generateInsights(game: SharpSignalGame): string[] {
    const teamParts = game.teams.split(' @ ');
    const awayTeam = teamParts[0] || 'Away';
    const homeTeam = teamParts[1] || 'Home';
    const sharpSide = game.public_sentiment_side === 'home' ? 'away' : 'home';
    const sharpTeam = sharpSide === 'home' ? homeTeam : awayTeam;

    const insights: string[] = [];
    const absDelta = Math.abs(game.spread_delta);
    const sharpSpreadVal = sharpSide === 'home' ? game.current_spread : -game.current_spread;

    // Spread movement strength
    if (absDelta >= 2) {
        insights.push(`🔥 Heavy sharp action — line moved ${absDelta} pts against public money. Strong RLM signal.`);
    } else if (absDelta >= 1.5) {
        insights.push(`📈 Solid line movement of ${absDelta} pts. Sharps are clearly positioned here.`);
    } else {
        insights.push(`📉 Line moved ${absDelta} pts — enough to flag reverse line movement.`);
    }

    // Ranked underdog getting points
    const sharpRank = sharpSide === 'home' ? game.home_rank : game.away_rank;
    const pubRank = sharpSide === 'home' ? game.away_rank : game.home_rank;
    if (sharpRank && sharpRank <= 25 && sharpSpreadVal > 0) {
        insights.push(`👑 Ranked #${sharpRank} team getting ${sharpSpreadVal} pts as an underdog — sharps love this spot.`);
    } else if (sharpRank && sharpRank <= 25) {
        insights.push(`👑 #${sharpRank} ${sharpTeam} backed by sharp money at ${sharpSpreadVal > 0 ? '+' : ''}${sharpSpreadVal}.`);
    }

    // Upset alert
    if (pubRank && pubRank <= 25 && (!sharpRank || sharpRank > 25)) {
        insights.push(`⚠️ Sharps fading ranked #${pubRank} team — potential upset brewing.`);
    }

    // Small underdog ML value
    if (sharpSpreadVal > 0 && sharpSpreadVal <= 5) {
        const sharpMLVal = sharpSide === 'home' ? game.moneyline_home : game.moneyline_away;
        if (sharpMLVal && sharpMLVal > 1) {
            const impliedProb = Math.round((1 / sharpMLVal) * 100);
            insights.push(`💰 Small underdog with ${100 - impliedProb}% upset chance — plus-money ML offers great value.`);
        }
    }

    // Big favorite context
    if (sharpSpreadVal < -7) {
        insights.push(`🎯 Large spread (${sharpSpreadVal}) — sharps believe this team covers convincingly.`);
    }

    // Efficiency Insights
    if (game.home_eff && game.away_eff) {
        const sharpEff = sharpSide === 'home' ? game.home_eff : game.away_eff;
        const pubEff = sharpSide === 'home' ? game.away_eff : game.home_eff;

        if (sharpEff.rank < pubEff.rank) {
            insights.push(`💪 Power Advantage: ${sharpTeam} ranks #${sharpEff.rank} in Torvik efficiency (${pubEff.rank} for opposition).`);
        }

        if (game.win_probability && game.win_probability > 60) {
            insights.push(`🎯 Analytics favorite: Log5 model gives ${sharpTeam} a ${game.win_probability}% win probability.`);
        }
    }

    // Timing & Manipulation Insights
    if (game.potential_head_fake) {
        insights.push(`🕵️ SWING SIGNAL: Significant line reversal detected. The spread moved one way earlier and has since swung back. Often indicates high volatility and sharp interest on both sides.`);
    }

    if (game.is_cross_zero) {
        insights.push(`🔄 CROSS-ZERO FLIP: High-conviction signal. The consensus has flipped the underdog and favorite status. Sharps are betting on a complete change in who wins.`);
    }

    if (game.delta_category === 'Sweet_Spot') {
        insights.push(`🎯 SWEET SPOT: The spread delta is in the high-probability 3-8 point range. This is historically the most consistent range for sharp system hits.`);
    }

    if (game.conference_type === 'Low-Major') {
        insights.push(`🏫 SMALL SCHOOL GAP: Sharps have a massive efficiency advantage in low-major conferences. The public is often slow to react to roster changes here.`);
    }

    if (game.is_golden_rule) {
        insights.push(`🏆 GOLDEN RULE: Elite setup detected. Sweet-spot movement in a low-major conference. This is currently our highest probability signal.`);
    }

    if (game.is_late_steam) {
        insights.push(`🚀 LATE STEAM: Heavy sharp action in the final hours. This late money is statistically the most reliable.`);
    }

    if (game.last_move_time) {
        const moveTime = new Date(game.last_move_time);
        const now = new Date();
        const diffMs = now.getTime() - moveTime.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));

        if (diffMins < 60 && diffMins >= 0) {
            insights.push(`⏱️ Recent Signal: This line moved just ${diffMins} minutes ago.`);
        } else if (diffMins < 1440 && diffMins >= 0) {
            insights.push(`⏱️ Signal Freshness: Last significant move was ${Math.floor(diffMins / 60)}h ago.`);
        }
    }

    return insights;
}
