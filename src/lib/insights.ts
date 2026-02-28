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

    return insights;
}
