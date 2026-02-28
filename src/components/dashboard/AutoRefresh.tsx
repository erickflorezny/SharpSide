'use client';

import { useEffect, useState } from 'react';

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function AutoRefresh() {
    const [lastSync, setLastSync] = useState<string>('Just now');
    const [isFetching, setIsFetching] = useState(false);

    useEffect(() => {
        // Don't fetch on mount — the server component already has fresh data.
        // Only auto-fetch on the interval.
        const interval = setInterval(fetchOdds, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    async function fetchOdds() {
        try {
            setIsFetching(true);
            const res = await fetch('/api/fetch-odds');
            if (res.ok) {
                setLastSync(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
                // Revalidate server data by refreshing
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
            {isFetching && (
                <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Syncing...
                </span>
            )}
            <span className="hidden sm:inline">
                Last Sync: <strong className="text-foreground">{lastSync}</strong>
            </span>
            <span className="text-muted-foreground/50 hidden sm:inline">· Auto every 15m</span>
        </div>
    );
}
