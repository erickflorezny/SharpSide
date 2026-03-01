import { SharpSignalGame } from '@/actions/getSharpSignals';
import { Card, CardContent, CardHeader, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Clock, Info, Shield, Award, Zap, ArrowRight, Newspaper, Minus } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { AddToParlayButton } from '@/components/parlay/AddToParlayButton';
import { generateInsights } from '@/lib/insights';

export function GameCard({ game }: { game: SharpSignalGame }) {
    const isSharp = Math.abs(game.spread_delta) >= 1.0;
    const formatSpread = (spread: number) => spread > 0 ? `+ ${spread} ` : spread.toString();
    const formatML = (ml: number | null) => {
        if (ml === null) return '—';
        return ml > 0 ? `+ ${ml} ` : ml.toString();
    };

    // Parse individual team names from "Away @ Home"
    const teamParts = game.teams.split(' @ ');
    const awayTeam = teamParts[0] || 'Away';
    const homeTeam = teamParts[1] || 'Home';

    // The sharp side is the OPPOSITE of the public side
    const sharpSide = game.public_sentiment_side === 'home' ? 'away' : 'home';
    const sharpTeam = sharpSide === 'home' ? homeTeam : awayTeam;
    const publicTeam = sharpSide === 'home' ? awayTeam : homeTeam;
    const insights = isSharp ? generateInsights(game) : [];

    return (
        <Card className={`relative overflow-hidden transition-all duration-200 border shadow-sm ${isSharp ? 'border-emerald-500/30 bg-zinc-900/40' : 'border-border/50 bg-background hover:border-primary/50'} `}>
            {isSharp && (
                <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none">
                    <div className="absolute transform translate-x-10 -translate-y-10 rotate-45 w-24 h-24 bg-emerald-500/10 blur-2xl"></div>
                </div>
            )}

            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <CardDescription className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2">
                            {new Date(game.commence_time).toLocaleDateString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                            {game.game_status === 'live' && (
                                <span className="flex items-center gap-1 text-[10px] text-red-400 font-bold">
                                    <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                                    LIVE
                                </span>
                            )}
                            {game.game_status === 'final' && (
                                <span className="text-[10px] text-muted-foreground/70 font-bold">FINAL</span>
                            )}
                        </CardDescription>
                        <div className="mt-1 space-y-0.5 max-w-xs">
                            <div className="flex items-center gap-1.5 text-sm font-bold tracking-tight truncate">
                                {game.away_rank && game.away_rank <= 25 && (
                                    <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1 py-0 leading-tight">#{game.away_rank}</span>
                                )}
                                <span className="truncate">{awayTeam}</span>
                                {game.away_score !== null && game.away_score !== undefined && (
                                    <span className={`ml-auto font-mono text-base ${game.game_status === 'final' && game.away_score > (game.home_score ?? 0) ? 'text-emerald-400' : 'text-foreground'} `}>
                                        {game.away_score}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span className="text-[10px]">@</span>
                                {game.home_rank && game.home_rank <= 25 && (
                                    <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1 py-0 leading-tight">#{game.home_rank}</span>
                                )}
                                <span className="truncate">{homeTeam}</span>
                                {game.home_score !== null && game.home_score !== undefined && (
                                    <span className={`ml-auto font-mono text-base font-bold ${game.game_status === 'final' && (game.home_score ?? 0) > (game.away_score ?? 0) ? 'text-emerald-400' : 'text-foreground'} `}>
                                        {game.home_score}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    {isSharp ? (() => {
                        const absDelta = Math.abs(game.spread_delta);
                        let label: string;
                        let badgeClass: string;

                        // Confidence-based labeling
                        if (game.confidence_score >= 85) {
                            label = '🚀 Strong Bet';
                            badgeClass = 'bg-amber-500/20 text-amber-400 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]';
                        } else if (absDelta >= 2) {
                            label = '🔥 Strong RLM';
                            badgeClass = 'bg-orange-500/20 text-orange-400 border-orange-500/20';
                        } else if (absDelta >= 1.5) {
                            label = '⚡ Sharp';
                            badgeClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20';
                        } else {
                            label = '📊 Sharp';
                            badgeClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20';
                        }

                        return (
                            <div className="flex flex-col items-end gap-1">
                                <Badge variant="default" className={`${badgeClass} hover:opacity-80 flex gap-1 items-center px-1.5 py-0 text-[10px] font-bold`}>
                                    <span>{label}</span>
                                </Badge>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-mono text-muted-foreground/60">Δ{absDelta} pts</span>
                                    {game.result_win !== null && (
                                        <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3 border-none ${game.result_win ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'} `}>
                                            {game.result_win ? 'SIGNAL HIT' : 'SIGNAL MISSED'}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        );
                    })() : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground flex gap-1 items-center px-1.5 py-0">
                            <Minus className="h-3 w-3" />
                            Standard
                        </Badge>
                    )}
                </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-1">
                {isSharp && (
                    <div className="space-y-1.5 border-b border-border/30 pb-3 mb-2">
                        <div className="flex justify-between items-end text-[10px] font-bold uppercase tracking-tighter">
                            <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground">Confidence Score</span>
                                <Badge variant="outline" className="text-[8px] px-1 py-0 h-3 border-amber-500/20 text-amber-500/70 bg-amber-500/5 font-mono">
                                    TUNED
                                </Badge>
                            </div>
                            <span className={game.confidence_score >= 85 ? 'text-amber-400 animate-pulse' : 'text-zinc-400'}>
                                {game.confidence_score}%
                            </span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-800/50 rounded-full overflow-hidden border border-white/5">
                            <div
                                className={`h-full transition-all duration-1000 ease-out rounded-full ${game.confidence_score >= 85 ? 'bg-gradient-to-r from-amber-600 to-amber-400' :
                                        game.confidence_score >= 70 ? 'bg-emerald-500' : 'bg-zinc-600'
                                    }                                    }`}
                                style={{ width: `${game.confidence_score}%` }}
                            />
                        </div>
                        <p className="text-[9px] text-muted-foreground/50 leading-tight">
                            Based on RLM magnitude, team rankings, and historical signal performance.
                        </p>
                    </div>
                )}
                {/* Spread Row */}
                <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="flex flex-col border-r border-border/50">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Open</span>
                        <span className="font-mono text-lg">{formatSpread(game.opening_spread)}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Current</span>
                        <span className="font-mono text-lg flex items-center gap-2">
                            {formatSpread(game.current_spread)}
                            {game.spread_price && (
                                <span className="text-[10px] text-muted-foreground font-mono">({formatML(game.spread_price)})</span>
                            )}
                            {game.spread_delta !== 0 && (
                                <span className={`text-xs ml-auto font-medium ${game.spread_delta > 0 ? 'text-rose-400' : 'text-emerald-400'} `}>
                                    {game.spread_delta > 0 ? '+' : ''}{game.spread_delta}
                                </span>
                            )}
                        </span>
                    </div>
                </div>

                {/* Win Probability */}
                <div className="border-t border-border/20 pt-2">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono mb-2 block">Win Probability</span>
                    {(() => {
                        const rawAwayProb = game.moneyline_away ? (1 / game.moneyline_away) * 100 : 50;
                        const rawHomeProb = game.moneyline_home ? (1 / game.moneyline_home) * 100 : 50;
                        const total = rawAwayProb + rawHomeProb;
                        const awayProb = Math.round((rawAwayProb / total) * 100);
                        const homeProb = 100 - awayProb;

                        return (
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground/70 w-[60px] truncate font-mono">{awayTeam.split(' ').pop()}</span>
                                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all ${awayProb > homeProb ? 'bg-emerald-500' : 'bg-zinc-600'} `} style={{ width: `${awayProb}%` }} />
                                    </div>
                                    <span className={`text-xs font-mono font-bold w-10 text-right ${awayProb > homeProb ? 'text-emerald-400' : 'text-muted-foreground'} `}>{awayProb}%</span>
                                    <span className="text-[10px] font-mono text-muted-foreground/50">{formatML(game.moneyline_away)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground/70 w-[60px] truncate font-mono">{homeTeam.split(' ').pop()}</span>
                                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all ${homeProb > awayProb ? 'bg-emerald-500' : 'bg-zinc-600'} `} style={{ width: `${homeProb}%` }} />
                                    </div>
                                    <span className={`text-xs font-mono font-bold w-10 text-right ${homeProb > awayProb ? 'text-emerald-400' : 'text-muted-foreground'} `}>{homeProb}%</span>
                                    <span className="text-[10px] font-mono text-muted-foreground/50">{formatML(game.moneyline_home)}</span>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Over/Under Totals */}
                {game.total_points && (
                    <div className="flex items-center justify-between border-t border-border/20 pt-2">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Total</span>
                        <div className="flex items-center gap-2 text-xs font-mono">
                            <span className="font-medium text-foreground">{game.total_points}</span>
                            <span className="text-[10px] text-muted-foreground">O {formatML(game.over_price)}</span>
                            <span className="text-[10px] text-muted-foreground">U {formatML(game.under_price)}</span>
                        </div>
                    </div>
                )}

                {/* Sharp Pick — the main actionable callout */}
                {isSharp && (() => {
                    const sharpSpread = sharpSide === 'home' ? game.current_spread : -game.current_spread;
                    const sharpML = sharpSide === 'home' ? game.moneyline_home : game.moneyline_away;

                    let suggestedBet: string;
                    let suggestedReason: string;
                    let suggestedValue: string;

                    if (sharpSpread > 0 && sharpSpread <= 5) {
                        suggestedBet = 'Take ML';
                        suggestedValue = sharpML !== null ? formatML(sharpML) : '';
                        suggestedReason = `${sharpTeam} is a small underdog (${formatSpread(sharpSpread)}). Sharp money likes them to win outright — the ML at ${suggestedValue} offers strong value.`;
                    } else if (sharpSpread > 5) {
                        suggestedBet = 'Take Spread';
                        suggestedValue = formatSpread(sharpSpread);
                        suggestedReason = `${sharpTeam} is a big underdog (${formatSpread(sharpSpread)}). Winning outright is unlikely, but sharps believe they cover the spread.`;
                    } else {
                        suggestedBet = 'Take Spread';
                        suggestedValue = formatSpread(sharpSpread);
                        suggestedReason = `${sharpTeam} is favored (${formatSpread(sharpSpread)}). The spread offers better value than the expensive ML juice on favorites.`;
                    }

                    return (
                        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 flex items-center gap-2">
                            <ArrowRight className="h-4 w-4 text-emerald-400 shrink-0" />
                            <div className="flex flex-col min-w-0">
                                <span className="text-[10px] uppercase tracking-widest text-emerald-400/70 font-mono">Sharp Pick</span>
                                <span className="text-sm font-bold text-emerald-400 truncate">{sharpTeam}</span>
                            </div>
                            <Badge className="ml-auto shrink-0 bg-amber-500/15 text-amber-400 border-amber-500/20 hover:bg-amber-500/25 font-mono text-[10px] px-2 py-0.5 cursor-default">
                                {suggestedBet} {suggestedValue}
                            </Badge>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <button className="shrink-0 p-1 rounded-full hover:bg-zinc-800 transition-colors">
                                        <Info className="h-3.5 w-3.5 text-emerald-400/50 hover:text-emerald-400 transition-opacity" />
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent side="top" className="max-w-[280px] text-xs leading-relaxed p-3">
                                    <p className="mb-1.5"><strong>{suggestedBet}:</strong> {suggestedReason}</p>
                                    <p className="text-muted-foreground/70">Public is on {publicTeam}. Sharps are going the other way.</p>
                                </PopoverContent>
                            </Popover>
                            <AddToParlayButton leg={{
                                gameId: game.id,
                                teamName: sharpTeam,
                                betType: suggestedBet === 'Take ML' ? 'ML' : 'Spread',
                                line: suggestedBet === 'Take ML' ? formatML(sharpML) : suggestedValue,
                                odds: (() => {
                                    const decOdds = suggestedBet === 'Take ML' && sharpML !== null
                                        ? sharpML
                                        : game.spread_price !== null
                                            ? game.spread_price
                                            : 1.91;
                                    if (decOdds >= 2) {
                                        return Math.round((decOdds - 1) * 100);
                                    } else {
                                        return Math.round(-100 / (decOdds - 1));
                                    }
                                })(),
                                matchup: game.teams,
                                insights: insights,
                            }} />
                        </div>
                    );
                })()}
            </CardContent>

            <CardFooter className="pt-0 pb-3 border-t border-border/10 pt-3 flex justify-between items-center bg-card mt-auto">
                <div className="text-[11px] text-muted-foreground flex gap-1 items-center">
                    <span className="opacity-50">via</span>
                    <span className="font-medium">{game.bookmaker}</span>
                    <span className="opacity-30 mx-1">·</span>
                    <span className="opacity-70">Pub. Side:</span>
                    <span className="font-medium capitalize">{game.public_sentiment_side}</span>
                </div>
                {isSharp && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="flex items-center gap-1 text-[10px] text-sky-400/70 hover:text-sky-400 transition-colors px-2 py-1 rounded-md hover:bg-zinc-800/50">
                                <Newspaper className="h-3 w-3" />
                                <span>Insight</span>
                            </button>
                        </PopoverTrigger>
                        <PopoverContent side="top" className="max-w-[280px] text-xs leading-relaxed p-3">
                            <p className="font-semibold text-foreground mb-1.5">📊 Game Insight</p>
                            <ul className="space-y-1 text-muted-foreground list-none">
                                {insights.map((insight, i) => (
                                    <li key={i} className="text-[11px] leading-snug">{insight}</li>
                                ))}
                            </ul>
                        </PopoverContent>
                    </Popover>
                )}
            </CardFooter>
        </Card>
    );
}
