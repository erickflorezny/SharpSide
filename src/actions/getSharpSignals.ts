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
    win_probability: number | null;
    home_eff?: { rank: number; oe: number; de: number };
    away_eff?: { rank: number; oe: number; de: number };
    last_move_time?: string | null;
    is_late_steam?: boolean;
    potential_head_fake?: boolean;
    market_maker_count: number;
    handle_pct_home: number | null;
    ticket_pct_home: number | null;
    delta_category?: string;
    is_cross_zero?: boolean;
    is_golden_rule?: boolean;
    conference_type?: string;
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

/**
 * Normalizes team names for Torvik matching.
 */
function normalizeTeamName(name: string): string {
    return name
        .replace('State', 'St.')
        .replace('University', '')
        .replace('UConn', 'Connecticut')
        .replace('UMass', 'Massachusetts')
        .trim();
}

/**
 * Calculates Log5/Barthag win probability.
 */
function calculateWinProb(a: number, b: number): number {
    return (a - a * b) / (a + b - 2 * a * b);
}

export async function getSharpSignals(filters?: {
    top25Only?: boolean;
    homeFavoritesOnly?: boolean;
    strongBetsOnly?: boolean;
}): Promise<SharpSignalGame[]> {
    const supabase = await createClient();

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Fetch Games with Snapshots
    const { data: games, error } = await supabase
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
            market_maker_count,
            handle_pct_home,
            ticket_pct_home,
            delta_category,
            is_cross_zero,
            is_golden_rule,
            conference_type,
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

    if (error) {
        console.error("Error fetching signals:", error);
        return [];
    }

    // 2. Fetch All Efficiency Data for Joins
    const { data: efficiency } = await supabase
        .from('team_efficiency')
        .select('*');

    const effMap = new Map(efficiency?.map(e => [e.team_name.toLowerCase(), e]) || []);

    const results: SharpSignalGame[] = [];
    const seenGames = new Set<string>();

    const sortedGames = [...(games || [])].sort((a, b) => {
        const aHasResult = a.result_win !== null || a.home_score !== null;
        const bHasResult = b.result_win !== null || b.home_score !== null;
        if (aHasResult && !bHasResult) return -1;
        if (!aHasResult && bHasResult) return 1;
        return 0;
    });

    for (const game of sortedGames) {
        const teamsParts = game.teams.split(' @ ');
        const awayTeam = teamsParts[0] || '';
        const homeTeam = teamsParts[1] || '';
        const teamsNorm = [awayTeam.toLowerCase(), homeTeam.toLowerCase()].sort().join('-').trim();

        const gameDate = new Date(game.commence_time);
        const offsetDate = new Date(gameDate.getTime() - (7 * 60 * 60 * 1000));
        const dateNorm = offsetDate.toISOString().split('T')[0];
        const uniqueKey = `${teamsNorm}-${dateNorm}`;

        if (seenGames.has(uniqueKey)) continue;
        seenGames.add(uniqueKey);

        if (!game.odds_snapshots || game.odds_snapshots.length === 0) continue;

        const sortedSnapshots = [...game.odds_snapshots].sort(
            (a: RawSnapshot, b: RawSnapshot) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const openingSnapshot = sortedSnapshots.find(s => s.is_opening_line) || sortedSnapshots[0];
        const currentSnapshot = sortedSnapshots[sortedSnapshots.length - 1];

        if (!openingSnapshot || !currentSnapshot) continue;

        const openingSpread = openingSnapshot.spread;
        const currentSpread = currentSnapshot.spread;
        const spreadDelta = currentSpread - openingSpread;

        if (Math.abs(spreadDelta) >= 1.0) {
            let pubSide = 'unknown';
            if (currentSpread < 0) {
                pubSide = spreadDelta > 0 ? 'home' : 'away';
            } else {
                pubSide = spreadDelta > 0 ? 'away' : 'home';
            }

            // Head Fake & Late Steam Analysis
            let peakDelta = 0;
            let lastSignificantMoveTime = sortedSnapshots[0].timestamp;
            let hasSignificantReversal = false;

            for (let i = 1; i < sortedSnapshots.length; i++) {
                const snap = sortedSnapshots[i];
                const deltaFromOpen = snap.spread - openingSpread;

                // Track peak move magnitude (farthest from opening)
                if (Math.abs(deltaFromOpen) > Math.abs(peakDelta)) {
                    peakDelta = deltaFromOpen;
                }

                // Track last significant move (>= 0.5 pts)
                const prevSnap = sortedSnapshots[i - 1];
                if (Math.abs(snap.spread - prevSnap.spread) >= 0.5) {
                    lastSignificantMoveTime = snap.timestamp;
                }
            }

            // A "Head Fake" is when the line moves significantly one way, 
            // then moves back significantly (>= 1.5 pts from peak) the other way.
            const reversalMagnitude = peakDelta - spreadDelta; // If peak was +4 and current is +2, reversal is 2
            if (Math.abs(reversalMagnitude) >= 1.5 && Math.abs(peakDelta) > Math.abs(spreadDelta)) {
                hasSignificantReversal = true;
            }

            const gameStatus = game.game_status ?? 'upcoming';
            const startTime = new Date(game.commence_time).getTime();
            const lastMoveTime = new Date(lastSignificantMoveTime).getTime();
            const now = Date.now();

            // Late Steam: Significant move within 2 hours of kickoff
            const isLateSteam = (startTime - lastMoveTime) < (2 * 60 * 60 * 1000) && (startTime - lastMoveTime) > 0;

            if (gameStatus === 'upcoming' && (now - startTime) > 4 * 60 * 60 * 1000) {
                continue;
            }

            let resultWinFiltered = game.result_win ?? null;
            const hasScores = game.home_score !== null && game.away_score !== null;
            if (resultWinFiltered === null && gameStatus === 'final' && hasScores && game.signal_side) {
                const homeAdjusted = (game.home_score || 0) + currentSpread;
                if (game.signal_side === 'home') {
                    if (homeAdjusted !== game.away_score) resultWinFiltered = homeAdjusted > (game.away_score || 0);
                } else {
                    if ((game.away_score || 0) !== homeAdjusted) resultWinFiltered = (game.away_score || 0) > homeAdjusted;
                }
            }

            // 3. Efficiency Join & Win Probability
            const homeEff = effMap.get(normalizeTeamName(homeTeam).toLowerCase()) || effMap.get(homeTeam.toLowerCase());
            const awayEff = effMap.get(normalizeTeamName(awayTeam).toLowerCase()) || effMap.get(awayTeam.toLowerCase());

            let winProb = null;
            if (homeEff && awayEff) {
                // Barthag Win Prob
                winProb = calculateWinProb(homeEff.barthag, awayEff.barthag);
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
                result_win: resultWinFiltered,
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
                public_sentiment_side: pubSide,
                win_probability: winProb ? Math.round(winProb * 100) : null,
                home_eff: homeEff ? { rank: homeEff.barthag_rank, oe: homeEff.adj_oe, de: homeEff.adj_de } : undefined,
                away_eff: awayEff ? { rank: awayEff.barthag_rank, oe: awayEff.adj_oe, de: awayEff.adj_de } : undefined,
                last_move_time: lastSignificantMoveTime,
                is_late_steam: isLateSteam,
                potential_head_fake: hasSignificantReversal,
                market_maker_count: game.market_maker_count ?? 0,
                handle_pct_home: game.handle_pct_home ?? null,
                ticket_pct_home: game.ticket_pct_home ?? null,
                delta_category: game.delta_category ?? undefined,
                is_cross_zero: game.is_cross_zero ?? false,
                is_golden_rule: game.is_golden_rule ?? false,
                conference_type: game.conference_type ?? undefined
            });
        }
    }

    let filteredResults = results;
    if (filters?.top25Only) {
        filteredResults = filteredResults.filter(g => (g.home_rank && g.home_rank <= 25) || (g.away_rank && g.away_rank <= 25));
    }
    if (filters?.homeFavoritesOnly) {
        filteredResults = filteredResults.filter(g => g.current_spread < 0);
    }
    if (filters?.strongBetsOnly) {
        filteredResults = filteredResults.filter(g => g.confidence_score >= 80);
    }

    // FINAL SMART SORT:
    // 1. Live Games first (By time ASC)
    // 2. Upcoming Games next (By time ASC)
    // 3. Final Games last (By time DESC)
    return filteredResults.sort((a, b) => {
        const statusPriority: Record<string, number> = { 'live': 1, 'upcoming': 2, 'final': 3 };
        const aPriority = statusPriority[a.game_status || 'upcoming'];
        const bPriority = statusPriority[b.game_status || 'upcoming'];
        if (aPriority !== bPriority) return aPriority - bPriority;
        const aTime = new Date(a.commence_time).getTime();
        const bTime = new Date(b.commence_time).getTime();
        if (a.game_status === 'final') return bTime - aTime;
        return aTime - bTime;
    });
}
