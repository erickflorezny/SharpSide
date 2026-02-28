'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function AutoRefresh() {
    const [lastSync, setLastSync] = useState<string>('Just now');
    const [isFetching, setIsFetching] = useState(false);

    useEffect(() => {
        const interval = setInterval(fetchOdds, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    async function fetchOdds() {
        try {
            setIsFetching(true);
            // Fetch odds and scores in parallel — scores use free ESPN API
            const [oddsRes, scoresRes] = await Promise.all([
                fetch('/api/fetch-odds'),
                fetch('/api/fetch-scores'),
            ]);
            if (oddsRes.ok || scoresRes.ok) {
                setLastSync(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
                window.location.reload();
            }
        } catch (e) {
            console.error('Auto-refresh failed:', e);
        } finally {
            setIsFetching(false);
        }
    }

    return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <button
                onClick={fetchOdds}
                disabled={isFetching}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-border/50 text-foreground transition-colors disabled:opacity-50"
                title="Refresh odds data"
            >
                <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline text-[10px] font-medium">{isFetching ? 'Syncing...' : 'Refresh'}</span>
            </button>
            <span className="hidden sm:inline">
                Last Sync: <strong className="text-foreground">{lastSync}</strong>
            </span>
            <span className="text-muted-foreground/50 hidden sm:inline">· Auto every 15m</span>
        </div>
    );
}
