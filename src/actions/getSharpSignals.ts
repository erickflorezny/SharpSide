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
    signal_side: 'home' | 'away' | null;
    confidence_score: number;
    result_win: boolean | null;
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

interface RawSnapshot {
    spread: number;
    spread_price: number | null;
    moneyline_home: number | null;
    moneyline_away: number | null;
    total_points: number | null;
    over_price: number | null;
    under_price: number | null;
    bookmaker: string;
    is_opening_line: boolean;
    timestamp: string;
}

interface RawGame {
    id: string;
    teams: string;
    commence_time: string;
    home_rank: number | null;
    away_rank: number | null;
    home_score?: number | null;
    away_score?: number | null;
    game_status?: string | null;
    signal_side?: 'home' | 'away' | null;
    confidence_score?: number | null;
    result_win?: boolean | null;
    odds_snapshots: RawSnapshot[];
}

export async function getSharpSignals(filters?: {
    top25Only?: boolean;
    homeFavoritesOnly?: boolean;
    strongBetsOnly?: boolean;
}): Promise<SharpSignalGame[]> {
    const supabase = await createClient();

    // Query games that have odds_snapshots.
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let games: RawGame[] | null = null;
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
      signal_side,
      confidence_score,
      result_win,
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
        .gte('commence_time', twentyFourHoursAgo)
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
            .gte('commence_time', twentyFourHoursAgo)
            .order('commence_time', { ascending: true });

        games = fallback.data as unknown as RawGame[];
        error = fallback.error;
    } else {
        games = result.data as unknown as RawGame[];
        error = result.error;
    }

    if (error) {
        console.error("Error fetching signals from Supabase:", error);
        return [];
    }

    const results: SharpSignalGame[] = [];
    const seenGames = new Set<string>();

    for (const game of games || []) {
        // De-duplicate games (more robustly)
        const teamsParts = game.teams.toLowerCase().split(' @ ');
        const teamsNorm = teamsParts.sort().join('-').trim();

        // Use a 12-hour offset to normalize dates to the "game day" in US timezones 
        // to prevent UTC midnight rollovers from creating duplicates
        const gameDate = new Date(game.commence_time);
        const offsetDate = new Date(gameDate.getTime() - (7 * 60 * 60 * 1000)); // -7h for MT/PT buffer
        const dateNorm = offsetDate.toISOString().split('T')[0];
        const uniqueKey = `${teamsNorm}-${dateNorm}`;

        if (seenGames.has(uniqueKey)) continue;
        seenGames.add(uniqueKey);

        // We need at least 2 snapshots to measure true line movement.
        if (!game.odds_snapshots || game.odds_snapshots.length === 0) continue;

        // Sort snapshots by time
        const sortedSnapshots = [...game.odds_snapshots].sort(
            (a: RawSnapshot, b: RawSnapshot) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
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

            const gameStatus = game.game_status ?? 'upcoming';
            const startTime = new Date(game.commence_time).getTime();
            const now = Date.now();

            // STALE FILTER: If a game is still 'upcoming' but started > 4 hours ago, 
            // it's likely finished but status hasn't updated. Hide it to keep dashboard clean.
            if (gameStatus === 'upcoming' && (now - startTime) > 4 * 60 * 60 * 1000) {
                continue;
            }

            results.push({
                id: game.id,
                teams: game.teams,
                commence_time: game.commence_time,
                home_rank: game.home_rank,
                away_rank: game.away_rank,
                home_score: game.home_score ?? null,
                away_score: game.away_score ?? null,
                game_status: gameStatus,
                signal_side: game.signal_side ?? null,
                confidence_score: game.confidence_score ?? 50,
                result_win: game.result_win ?? null,
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

    if (filters?.strongBetsOnly) {
        filteredResults = filteredResults.filter(g => g.confidence_score >= 80);
    }

    // FINAL SMART SORT:
    // 1. Live Games first (By time ASC)
    // 2. Upcoming Games next (By time ASC)
    // 3. Final Games last (By time DESC - most recent at top of results section)
    return filteredResults.sort((a, b) => {
        const statusPriority: Record<string, number> = { 'live': 1, 'upcoming': 2, 'final': 3 };
        const aPriority = statusPriority[a.game_status || 'upcoming'];
        const bPriority = statusPriority[b.game_status || 'upcoming'];

        if (aPriority !== bPriority) return aPriority - bPriority;

        const aTime = new Date(a.commence_time).getTime();
        const bTime = new Date(b.commence_time).getTime();

        // If both are 'final', sort descending (most recent first)
        if (a.game_status === 'final') return bTime - aTime;

        // Otherwise sort ascending (soonest first)
        return aTime - bTime;
    });
}
