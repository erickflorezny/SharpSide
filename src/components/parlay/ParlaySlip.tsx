'use client';

import { useParlay } from './ParlayContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Ticket, Trash2, Newspaper } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useState } from 'react';

function formatAmericanOdds(odds: number): string {
    return odds > 0 ? `+${odds}` : odds.toString();
}

export function ParlaySlip() {
    const { legs, removeLeg, clearParlay, isOpen, setIsOpen, parlayOdds, parlayPayout } = useParlay();
    const [wager, setWager] = useState<string>('10');
    const wagerNum = parseFloat(wager) || 0;

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <button
                    className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold px-4 py-3 rounded-full shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95"
                    onClick={() => setIsOpen(true)}
                >
                    <Ticket className="h-5 w-5" />
                    <span>Parlay</span>
                    {legs.length > 0 && (
                        <Badge className="bg-black/20 text-white ml-1 px-1.5 py-0 text-xs">{legs.length}</Badge>
                    )}
                </button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md bg-zinc-950 border-l border-border/50 flex flex-col">
                <SheetHeader className="border-b border-border/30 pb-4">
                    <SheetTitle className="flex items-center gap-2 text-foreground">
                        <Ticket className="h-5 w-5 text-emerald-400" />
                        Parlay Builder
                    </SheetTitle>
                    <SheetDescription>
                        Combine sharp picks into a parlay. {legs.length} leg{legs.length !== 1 ? 's' : ''} selected.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto py-4 space-y-2">
                    {legs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center px-8">
                            <Ticket className="h-10 w-10 text-muted-foreground/30 mb-3" />
                            <p className="text-sm text-muted-foreground">No legs added yet</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                                Click the + button on any sharp signal card to add it to your parlay.
                            </p>
                        </div>
                    ) : (
                        legs.map((leg) => (
                            <div key={leg.gameId} className="bg-zinc-900/60 border border-border/30 rounded-lg p-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-muted-foreground truncate">{leg.matchup}</p>
                                        <p className="text-sm font-semibold text-emerald-400 truncate">{leg.teamName}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                                {leg.betType === 'ML' ? 'ML' : `Spread ${leg.line}`}
                                            </Badge>
                                            <span className="text-xs font-mono text-amber-400">{formatAmericanOdds(leg.odds)}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {leg.insights && leg.insights.length > 0 && (
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <button className="text-sky-400/60 hover:text-sky-400 transition-colors p-1 rounded-md hover:bg-zinc-800/50">
                                                        <Newspaper className="h-3.5 w-3.5" />
                                                    </button>
                                                </PopoverTrigger>
                                                <PopoverContent side="left" className="max-w-[260px] text-xs leading-relaxed p-3">
                                                    <p className="font-semibold text-foreground mb-1.5">📊 Game Insight</p>
                                                    <ul className="space-y-1 text-muted-foreground list-none">
                                                        {leg.insights.map((insight, i) => (
                                                            <li key={i} className="text-[11px] leading-snug">{insight}</li>
                                                        ))}
                                                    </ul>
                                                </PopoverContent>
                                            </Popover>
                                        )}
                                        <button
                                            onClick={() => removeLeg(leg.gameId)}
                                            className="text-muted-foreground/50 hover:text-rose-400 transition-colors p-1"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {legs.length > 0 && (
                    <div className="border-t border-border/30 pt-4 space-y-4">
                        {/* Odds Summary */}
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Parlay Odds</span>
                            <span className="font-mono font-bold text-lg text-amber-400">
                                {formatAmericanOdds(parlayOdds)}
                            </span>
                        </div>

                        {/* Wager Input */}
                        <div className="flex items-center gap-3">
                            <label className="text-sm text-muted-foreground shrink-0">Wager $</label>
                            <Input
                                type="number"
                                min="1"
                                value={wager}
                                onChange={(e) => setWager(e.target.value)}
                                className="bg-zinc-900 border-border/50 font-mono text-right"
                                placeholder="10"
                            />
                        </div>

                        {/* Payout */}
                        <div className="flex justify-between items-center bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">
                            <span className="text-sm text-emerald-400/70">Potential Payout</span>
                            <span className="font-mono font-bold text-xl text-emerald-400">
                                ${parlayPayout(wagerNum).toFixed(2)}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={clearParlay}
                                className="text-xs text-muted-foreground"
                            >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Clear All
                            </Button>
                            <span className="ml-auto text-[10px] text-muted-foreground/40">{legs.length} leg parlay</span>
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
