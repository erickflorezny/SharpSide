'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

const ODDS_SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes
const SCORE_SYNC_INTERVAL = 60 * 1000;      // 60 seconds

export function AutoRefresh() {
    const router = useRouter();
    const [lastOddsSync, setLastOddsSync] = useState<string>('Just now');
    const [lastScoreSync, setLastScoreSync] = useState<string>('Just now');
    const [isSyncingOdds, setIsSyncingOdds] = useState(false);
    const [isSyncingScores, setIsSyncingScores] = useState(false);
    const [isCalibrating, setIsCalibrating] = useState(false);
    const [calibrationMsg, setCalibrationMsg] = useState<string>('System Tuned');
    const [accuracy, setAccuracy] = useState<number | null>(null);

    const syncScores = useCallback(async () => {
        try {
            setIsSyncingScores(true);
            const res = await fetch('/api/fetch-scores');
            if (res.ok) {
                setLastScoreSync(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
                router.refresh();
            }
        } catch (e) {
            console.error('Score sync failed:', e);
        } finally {
            setIsSyncingScores(false);
        }
    }, [router]);

    const syncAll = useCallback(async () => {
        try {
            setIsSyncingOdds(true);
            setIsSyncingScores(true);

            // Fetch both in parallel
            const [oddsRes, scoresRes] = await Promise.all([
                fetch('/api/fetch-odds'),
                fetch('/api/fetch-scores')
            ]);

            if (oddsRes.ok || scoresRes.ok) {
                const now = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                setLastOddsSync(now);
                setLastScoreSync(now);
                router.refresh();
            }
        } catch (e) {
            console.error('Full sync failed:', e);
        } finally {
            setIsSyncingOdds(false);
            setIsSyncingScores(false);
        }
    }, [router]);

    // Initial sync
    useEffect(() => {
        // We sync all once on mount
        syncAll();

        // 15-minute interval for Odds (credits)
        const oddsTimer = setInterval(syncAll, ODDS_SYNC_INTERVAL);

        // 60-second interval for Scores (free)
        const scoreTimer = setInterval(syncScores, SCORE_SYNC_INTERVAL);

        return () => {
            clearInterval(oddsTimer);
            clearInterval(scoreTimer);
        };
    }, [syncAll, syncScores]);

    async function calibrate() {
        try {
            setIsCalibrating(true);
            const res = await fetch('/api/calibrate');
            const data = await res.json();
            if (data.success && data.stats) {
                setAccuracy(data.stats.overallWinRate);
                setCalibrationMsg(data.stats.adjustmentsMade > 0 ? 'Tuned Logic' : 'Optimal Path');
                setTimeout(() => setCalibrationMsg('System Tuned'), 5000);
            }
        } catch (e) {
            console.error('Calibration failed:', e);
        } finally {
            setIsCalibrating(false);
        }
    }

    const StatusIndicators = ({ isMobile = false }: { isMobile?: boolean }) => (
        <div className={`flex ${isMobile ? 'flex-col gap-4 p-4' : 'flex-row items-center gap-3 sm:gap-6'} `}>
            {/* Scores Sync Indicator */}
            <div className="flex items-center gap-2">
                <div className="relative flex items-center justify-center h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        Scores Live
                    </span>
                    <span className="text-[9px] text-muted-foreground whitespace-nowrap">Updated {lastScoreSync}</span>
                </div>
            </div>

            {/* Separator */}
            {!isMobile && <div className="hidden sm:block h-6 w-px bg-white/10" />}

            {/* Odds Sync Status & Button */}
            <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center gap-3 w-full sm:w-auto'} `}>
                <div className="flex items-center gap-2">
                    {accuracy !== null && (
                        <div className="flex flex-col items-end mr-1">
                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Strong Acc</span>
                            <span className="text-[11px] font-mono text-amber-200/90">{accuracy}%</span>
                        </div>
                    )}

                    <button
                        onClick={syncAll}
                        disabled={isSyncingOdds || isSyncingScores}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/5 text-zinc-200 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-lg"
                        title="Manual Deep Sync"
                    >
                        <RefreshCw className={`h-3 w-3 ${(isSyncingOdds || isSyncingScores) ? 'animate-spin text-emerald-400' : 'text-zinc-400'}`} />
                        <span className="text-xs font-semibold whitespace-nowrap">{(isSyncingOdds || isSyncingScores) ? 'Syncing...' : 'Sync Odds'}</span>
                    </button>

                    <button
                        onClick={calibrate}
                        disabled={isCalibrating}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-500 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-lg"
                        title="Calibrate Weights"
                    >
                        <Activity className={`h-3 w-3 ${isCalibrating ? 'animate-pulse' : ''}`} />
                        <span className="text-xs font-semibold whitespace-nowrap">
                            {isCalibrating ? 'Tuning...' : calibrationMsg}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex items-center">
            {/* Desktop View */}
            <div className="hidden md:flex bg-zinc-900/50 p-1.5 sm:p-2 rounded-xl border border-white/5 backdrop-blur-sm">
                <StatusIndicators />
            </div>

            {/* Mobile View - Popover */}
            <div className="md:hidden">
                <Popover>
                    <PopoverTrigger asChild>
                        <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900/80 border border-white/10 text-zinc-300 hover:bg-zinc-800 transition-all active:scale-95">
                            <div className="relative flex items-center justify-center h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                            </div>
                            <RefreshCw className={`h-3.5 w-3.5 ${(isSyncingOdds || isSyncingScores) ? 'animate-spin text-emerald-400' : ''}`} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Live</span>
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-[280px] bg-zinc-950/95 border-zinc-800 p-0 shadow-2xl backdrop-blur-xl">
                        <StatusIndicators isMobile />
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
}
