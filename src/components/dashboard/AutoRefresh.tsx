'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
            if (data.success) {
                setCalibrationMsg('Just Calibrated');
                setTimeout(() => setCalibrationMsg('System Tuned'), 5000);
            }
        } catch (e) {
            console.error('Calibration failed:', e);
        } finally {
            setIsCalibrating(false);
        }
    }

    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 bg-zinc-900/50 p-2 sm:p-2.5 rounded-xl border border-white/5 backdrop-blur-sm">
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
                    <span className="text-[9px] text-muted-foreground">Updated {lastScoreSync}</span>
                </div>
            </div>

            {/* Separator */}
            <div className="hidden sm:block h-6 w-px bg-white/10" />

            {/* Odds Sync Status & Button */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="flex flex-col mr-auto sm:mr-0">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Odds Snapshot</span>
                    <span className="text-[9px] text-muted-foreground">{lastOddsSync}</span>
                </div>

                <button
                    onClick={syncAll}
                    disabled={isSyncingOdds}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/5 text-zinc-200 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-lg"
                    title="Manual Deep Sync (Uses Odds API credits)"
                >
                    <RefreshCw className={`h-3 w-3 ${isSyncingOdds ? 'animate-spin text-emerald-400' : 'text-zinc-400'}`} />
                    <span className="text-xs font-semibold">{isSyncingOdds ? 'Syncing...' : 'Sync Odds'}</span>
                </button>

                <button
                    onClick={calibrate}
                    disabled={isCalibrating}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-500 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-lg"
                    title="Calibrate Weights (Analyzes past hits/misses)"
                >
                    <Activity className={`h-3 w-3 ${isCalibrating ? 'animate-pulse' : ''}`} />
                    <span className="text-xs font-semibold">
                        {isCalibrating ? 'Tuning...' : calibrationMsg}
                    </span>
                </button>
            </div>
        </div>
    );
}
