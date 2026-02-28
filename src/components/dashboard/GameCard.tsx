import { SharpSignalGame } from '@/actions/getSharpSignals';
import { Card, CardContent, CardHeader, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, Minus, Info, ArrowRight } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export function GameCard({ game }: { game: SharpSignalGame }) {
    const isSharp = Math.abs(game.spread_delta) >= 1.0;
    const formatSpread = (spread: number) => spread > 0 ? `+${spread}` : spread.toString();
    const formatML = (ml: number | null) => {
        if (ml === null) return '—';
        return ml > 0 ? `+${ml}` : ml.toString();
    };

    // Parse individual team names from "Away @ Home"
    const teamParts = game.teams.split(' @ ');
    const awayTeam = teamParts[0] || 'Away';
    const homeTeam = teamParts[1] || 'Home';

    // The sharp side is the OPPOSITE of the public side
    const sharpSide = game.public_sentiment_side === 'home' ? 'away' : 'home';
    const sharpTeam = sharpSide === 'home' ? homeTeam : awayTeam;
    const publicTeam = sharpSide === 'home' ? awayTeam : homeTeam;

    return (
        <Card className={`relative overflow-hidden transition-all duration-200 border shadow-sm ${isSharp ? 'border-emerald-500/30 bg-zinc-900/40' : 'border-border/50 bg-background hover:border-primary/50'}`}>
            {isSharp && (
                <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none">
                    <div className="absolute transform translate-x-10 -translate-y-10 rotate-45 w-24 h-24 bg-emerald-500/10 blur-2xl"></div>
                </div>
            )}

            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <CardDescription className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                            {new Date(game.commence_time).toLocaleDateString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                        </CardDescription>
                        <div className="text-sm font-bold tracking-tight mt-1 truncate max-w-xs">{game.teams}</div>
                    </div>
                    {isSharp ? (
                        <Badge variant="default" className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-emerald-500/20 flex gap-1 items-center px-1.5 py-0">
                            <TrendingDown className="h-3 w-3" />
                            <span>Sharp</span>
                        </Badge>
                    ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground flex gap-1 items-center px-1.5 py-0">
                            <Minus className="h-3 w-3" />
                            <span>Standard</span>
                        </Badge>
                    )}
                </div>
            </CardHeader>

            <CardContent className="pb-3 text-sm space-y-3">
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
                                <span className={`text-xs ml-auto font-medium ${game.spread_delta > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {game.spread_delta > 0 ? '+' : ''}{game.spread_delta}
                                </span>
                            )}
                        </span>
                    </div>
                </div>

                {/* Moneyline + Totals Row */}
                <div className="grid grid-cols-2 gap-4 border-t border-border/20 pt-2">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono mb-1">Moneyline</span>
                        <div className="flex items-center gap-3 text-xs font-mono">
                            <div className="flex flex-col">
                                <span className="text-[9px] text-muted-foreground/70 truncate max-w-[80px]">{awayTeam.split(' ').pop()}</span>
                                <span className={`font-medium ${game.moneyline_away && game.moneyline_away > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {formatML(game.moneyline_away)}
                                </span>
                            </div>
                            <span className="text-muted-foreground/30">|</span>
                            <div className="flex flex-col">
                                <span className="text-[9px] text-muted-foreground/70 truncate max-w-[80px]">{homeTeam.split(' ').pop()}</span>
                                <span className={`font-medium ${game.moneyline_home && game.moneyline_home > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {formatML(game.moneyline_home)}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col border-l border-border/50 pl-4">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono mb-1">Total</span>
                        {game.total_points ? (
                            <div className="flex flex-col text-xs font-mono">
                                <span className="font-medium text-foreground">{game.total_points}</span>
                                <div className="flex gap-2 text-[10px] text-muted-foreground">
                                    <span>O {formatML(game.over_price)}</span>
                                    <span>U {formatML(game.under_price)}</span>
                                </div>
                            </div>
                        ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                        )}
                    </div>
                </div>

                {/* Sharp Pick — the main actionable callout */}
                {isSharp && (() => {
                    // Determine the sharp team's effective spread
                    // If sharp side is home, their spread is current_spread
                    // If sharp side is away, their spread is -current_spread
                    const sharpSpread = sharpSide === 'home' ? game.current_spread : -game.current_spread;
                    const sharpML = sharpSide === 'home' ? game.moneyline_home : game.moneyline_away;

                    // Bet suggestion logic:
                    // Underdog (positive spread) with small spread (≤ 5): Take ML — they can win outright
                    // Big underdog (> 5 pts): Take Spread — hard to win outright
                    // Favorite (negative spread): Take Spread — ML juice on favorites is expensive
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
                        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 flex items-center gap-3">
                            <ArrowRight className="h-4 w-4 text-emerald-400 shrink-0" />
                            <div className="flex flex-col min-w-0">
                                <span className="text-[10px] uppercase tracking-widest text-emerald-400/70 font-mono">Sharp Pick</span>
                                <span className="text-sm font-bold text-emerald-400 truncate">{sharpTeam}</span>
                            </div>
                            <Badge className="ml-auto shrink-0 bg-amber-500/15 text-amber-400 border-amber-500/20 hover:bg-amber-500/25 font-mono text-[10px] px-2 py-0.5 cursor-default">
                                {suggestedBet} {suggestedValue}
                            </Badge>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="cursor-help shrink-0"><Info className="h-3.5 w-3.5 text-emerald-400/50 hover:text-emerald-400 transition-opacity" /></div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
                                    <p className="mb-1.5"><strong>{suggestedBet}:</strong> {suggestedReason}</p>
                                    <p className="text-muted-foreground/70">Public is on {publicTeam}. Sharps are going the other way.</p>
                                </TooltipContent>
                            </Tooltip>
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
                {game.home_rank && game.home_rank <= 25 && (
                    <Badge variant="outline" className="text-[10px] h-5 cursor-default">Top 25 Matchup</Badge>
                )}
            </CardFooter>
        </Card>
    );
}
