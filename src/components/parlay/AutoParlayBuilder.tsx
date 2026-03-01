'use client';

import { useParlay } from './ParlayContext';
import { SharpSignalGame } from '@/actions/getSharpSignals';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface AutoParlayBuilderProps {
    signals: SharpSignalGame[];
}

/**
 * Convert decimal odds to American odds.
 */
function decimalToAmerican(decimal: number): number {
    if (decimal >= 2) return Math.round((decimal - 1) * 100);
    return Math.round(-100 / (decimal - 1));
}

interface RankedPick {
    game: SharpSignalGame;
    sharpTeam: string;
    probability: number;
    betType: 'ML' | 'Spread';
    line: string;
    odds: number; // American
}

function rankSignals(signals: SharpSignalGame[], strongOnly: boolean): RankedPick[] {
    let filtered = signals;
    if (strongOnly) {
        filtered = signals.filter(s => s.confidence_score >= 80);
    }

    return filtered
        .map((game) => {
            const teamParts = game.teams.split(' @ ');
            const awayTeam = teamParts[0] || 'Away';
            const homeTeam = teamParts[1] || 'Home';
            const sharpSide = game.public_sentiment_side === 'home' ? 'away' : 'home';
            const sharpTeam = sharpSide === 'home' ? homeTeam : awayTeam;

            // Implied probability from decimal moneyline, normalized
            const sharpML = sharpSide === 'home' ? game.moneyline_home : game.moneyline_away;
            const otherML = sharpSide === 'home' ? game.moneyline_away : game.moneyline_home;
            const rawSharpProb = sharpML ? (1 / sharpML) * 100 : 50;
            const rawOtherProb = otherML ? (1 / otherML) * 100 : 50;
            const total = rawSharpProb + rawOtherProb;
            const probability = Math.round((rawSharpProb / total) * 100);

            // Bet type logic
            const sharpSpread = sharpSide === 'home' ? game.current_spread : -game.current_spread;
            const absSpread = Math.abs(sharpSpread);
            const formatSpread = (s: number) => s > 0 ? `+${s}` : s.toString();
            const formatMLStr = (ml: number | null) => {
                if (ml === null) return '';
                return ml > 0 ? `+${ml}` : ml.toString();
            };

            let betType: 'ML' | 'Spread';
            let line: string;
            let odds: number;

            if (sharpSpread > 0 && sharpSpread <= 5) {
                betType = 'ML';
                line = sharpML !== null ? formatMLStr(sharpML) : '';
                odds = sharpML !== null ? decimalToAmerican(sharpML) : -110;
            } else {
                betType = 'Spread';
                line = formatSpread(sharpSpread);
                odds = game.spread_price !== null ? decimalToAmerican(game.spread_price) : -110;
            }

            // Composite score: confidence_score is now the primary driver
            // Boost significantly for confidence >= 80
            const confidenceBonus = game.confidence_score >= 85 ? 50 : game.confidence_score >= 80 ? 30 : 0;
            const spreadPenalty = absSpread <= 5 ? 0 : absSpread <= 10 ? (absSpread - 5) * 3 : (absSpread - 5) * 6;
            const score = game.confidence_score + confidenceBonus - spreadPenalty;

            return { game, sharpTeam, probability, betType, line, odds, absSpread, score };
        })
        // Filter out spreads larger than 12 points (slightly more lenient if it's high confidence)
        .filter(pick => pick.absSpread <= 12)
        .sort((a, b) => b.score - a.score); // Best composite score first
}

export function AutoParlayBuilder({ signals }: AutoParlayBuilderProps) {
    const { addLeg, clearParlay, setIsOpen } = useParlay();
    const [legCount, setLegCount] = useState(3);
    const [strongOnly, setStrongOnly] = useState(true);

    const sharpSignals = signals.filter(s => Math.abs(s.spread_delta) >= 1.0);
    const filteredSignals = strongOnly ? sharpSignals.filter(s => s.confidence_score >= 80) : sharpSignals;
    const maxLegs = Math.min(filteredSignals.length, 8);

    // Adjust legCount if it exceeds maxLegs after filtering
    const effectiveLegCount = Math.min(legCount, maxLegs);

    if (sharpSignals.length < 2) return null;

    const handleAutoBuild = () => {
        clearParlay();
        const ranked = rankSignals(sharpSignals, strongOnly);
        const picks = ranked.slice(0, effectiveLegCount);

        for (const pick of picks) {
            addLeg({
                gameId: pick.game.id,
                teamName: pick.sharpTeam,
                betType: pick.betType,
                line: pick.line,
                odds: pick.odds,
                matchup: pick.game.teams,
            });
        }
        setIsOpen(true);
    };

    return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-zinc-900/60 border border-border/30 rounded-lg">
            <div className="flex items-center gap-3 min-w-0">
                <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
                <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-foreground">Auto-Build Parlay</span>
                    <span className="text-[10px] text-muted-foreground truncate">Using tuned learning weights</span>
                </div>
            </div>

            <div className="flex items-center gap-4 ml-auto">
                {/* Strong Only Toggle */}
                <div
                    onClick={() => setStrongOnly(!strongOnly)}
                    className="flex items-center gap-2 cursor-pointer group"
                >
                    <div className={`w-8 h-4 rounded-full transition-colors relative ${strongOnly ? 'bg-amber-500/30' : 'bg-zinc-800'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full transition-transform ${strongOnly ? 'translate-x-4 bg-amber-400' : 'bg-zinc-500'}`} />
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-tight transition-colors ${strongOnly ? 'text-amber-400' : 'text-muted-foreground group-hover:text-zinc-300'}`}>
                        Strong Only
                    </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center bg-zinc-800 border border-border/50 rounded-md">
                        <button
                            onClick={() => setLegCount(Math.max(2, legCount - 1))}
                            className="px-1.5 py-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ChevronDown className="h-3 w-3" />
                        </button>
                        <span className="text-xs font-mono font-bold text-foreground px-1 min-w-[20px] text-center">{effectiveLegCount}</span>
                        <button
                            onClick={() => setLegCount(Math.min(maxLegs, legCount + 1))}
                            disabled={legCount >= maxLegs}
                            className="px-1.5 py-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                        >
                            <ChevronUp className="h-3 w-3" />
                        </button>
                    </div>
                    <span className="text-[10px] text-muted-foreground">legs</span>
                    <Button
                        size="sm"
                        onClick={handleAutoBuild}
                        disabled={filteredSignals.length < 2}
                        className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs px-3 h-7 disabled:opacity-50 disabled:bg-zinc-800"
                    >
                        Build
                    </Button>
                </div>
            </div>
        </div>
    );
}
