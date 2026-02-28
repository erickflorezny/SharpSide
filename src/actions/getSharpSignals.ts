'use server';

import { createClient } from '@/utils/supabase/server';

export interface SharpSignalGame {
    id: string;
    teams: string;
    commence_time: string;
    home_rank: number | null;
    away_rank: number | null;
    home_score: number | null;
    away_score: number | null;
    game_status: string | null; // 'upcoming', 'live', 'final'
    opening_spread: number;
    current_spread: number;
    spread_delta: number;
    spread_price: number | null;
    moneyline_home: number | null;
    moneyline_away: number | null;
    total_points: number | null;
    over_price: number | null;
    under_price: number | null;
    bookmaker: string;
    public_sentiment_side: string;
}

export async function getSharpSignals(filters?: { top25Only?: boolean; homeFavoritesOnly?: boolean }): Promise<SharpSignalGame[]> {
    const supabase = await createClient();

    // Query games that have odds_snapshots.
    // In a robust production environment, you would use a Postgres View or RPC to handle this logic efficiently.
    // Show games from the last 6 hours onward (includes in-progress games)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    let games;
    let error;

    // Try with score columns first, fall back without if migration hasn't run
    const result = await supabase
        .from('games')
        .select(`
      id,
      teams,
      commence_time,
      home_rank,
      away_rank,
      home_score,
      away_score,
      game_status,
      odds_snapshots (
        spread,
        spread_price,
        moneyline_home,
        moneyline_away,
        total_points,
        over_price,
        under_price,
        bookmaker,
        is_opening_line,
        timestamp
      )
    `)
        .gte('commence_time', sixHoursAgo)
        .order('commence_time', { ascending: true });

    if (result.error) {
        // Fallback: query without score columns (migration not yet applied)
        const fallback = await supabase
            .from('games')
            .select(`
          id,
          teams,
          commence_time,
          home_rank,
          away_rank,
          odds_snapshots (
            spread,
            spread_price,
            moneyline_home,
            moneyline_away,
            total_points,
            over_price,
            under_price,
            bookmaker,
            is_opening_line,
            timestamp
          )
        `)
            .gte('commence_time', sixHoursAgo)
            .order('commence_time', { ascending: true });

        games = fallback.data;
        error = fallback.error;
    } else {
        games = result.data;
        error = result.error;
    }

    if (error) {
        console.error("Error fetching signals from Supabase:", error);
        return [];
    }

    const results: SharpSignalGame[] = [];

    for (const game of games || []) {
        // We need at least 2 snapshots to measure true line movement.
        // However, for testing this integration right now, we will allow games with just 1 snapshot to show up.
        if (!game.odds_snapshots || game.odds_snapshots.length === 0) continue;

        // Sort snapshots by time
        const sortedSnapshots = [...game.odds_snapshots].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const openingSnapshot = sortedSnapshots.find(s => s.is_opening_line) || sortedSnapshots[0];
        const currentSnapshot = sortedSnapshots[sortedSnapshots.length - 1];

        if (!openingSnapshot || !currentSnapshot) continue;

        const openingSpread = openingSnapshot.spread;
        const currentSpread = currentSnapshot.spread;

        // Spread delta: if opening is -5.0 and current is -3.0, delta is 2.0 (line moved towards the underdog).
        const spreadDelta = currentSpread - openingSpread;

        // Sharp Definition:
        // A simplified "Reverse Line Movement" indicator for this scaffold is when the 
        // line moves >= 1.0 point AGAINST the perceived favorite.
        if (Math.abs(spreadDelta) >= 1.0) {
            // Determine public side via simple heuristic
            let pubSide = 'unknown';
            if (currentSpread < 0) {
                pubSide = spreadDelta > 0 ? 'home' : 'away';
            } else {
                pubSide = spreadDelta > 0 ? 'away' : 'home';
            }

            results.push({
                id: game.id,
                teams: game.teams,
                commence_time: game.commence_time,
                home_rank: game.home_rank,
                away_rank: game.away_rank,
                home_score: (game as any).home_score ?? null,
                away_score: (game as any).away_score ?? null,
                game_status: (game as any).game_status ?? 'upcoming',
                opening_spread: openingSpread,
                current_spread: currentSpread,
                spread_delta: spreadDelta,
                spread_price: currentSnapshot.spread_price ?? null,
                moneyline_home: currentSnapshot.moneyline_home ?? null,
                moneyline_away: currentSnapshot.moneyline_away ?? null,
                total_points: currentSnapshot.total_points ?? null,
                over_price: currentSnapshot.over_price ?? null,
                under_price: currentSnapshot.under_price ?? null,
                bookmaker: currentSnapshot.bookmaker ?? 'Unknown',
                public_sentiment_side: pubSide
            });
        }
    }

    let filteredResults = results;

    if (filters?.top25Only) {
        filteredResults = filteredResults.filter(g => (g.home_rank && g.home_rank <= 25) || (g.away_rank && g.away_rank <= 25));
    }

    if (filters?.homeFavoritesOnly) {
        // Assuming negative spread means home favorite
        filteredResults = filteredResults.filter(g => g.current_spread < 0);
    }

    return filteredResults;
}
