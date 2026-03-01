import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getTeamRank } from '@/lib/rankings';

interface Outcome {
    name: string;
    price: number;
    point?: number | null;
}

interface Market {
    key: string;
    outcomes: Outcome[];
}

interface Bookmaker {
    key: string;
    title: string;
    markets: Market[];
}

interface StandardGame {
    id: string;
    commence_time: string;
    home_team: string;
    away_team: string;
    bookmakers: Bookmaker[];
}

export async function GET() {
    try {
        const ODDS_API_KEY = process.env.ODDS_API_KEY;
        if (!ODDS_API_KEY) {
            return NextResponse.json({ error: 'ODDS_API_KEY is not configured.' }, { status: 500 });
        }

        let data: StandardGame[] = [];
        let source = 'NONE';
        const chainErrors: { provider: string; status?: number; details?: string; error?: string }[] = [];

        // --- STEP 1: The Odds API (Primary) ---
        const response = await fetch(`https://api.the-odds-api.com/v4/sports/basketball_ncaab/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads,h2h,totals`, {
            next: { revalidate: 0 }
        });

        if (response.ok) {
            data = await response.json();
            source = 'The Odds API';
            console.log(`The Odds API returned ${data?.length || 0} items.`);
        }
        // --- STEP 2: SportsDataIO Fallback ---
        else {
            const errorText = await response.text();
            chainErrors.push({ provider: 'The Odds API', status: response.status, details: errorText });
            console.warn(`The Odds API failed (Status: ${response.status}). Attempting SportsDataIO fallback...`);
            const SPORTSDATA_IO_KEY = process.env.SPORTSDATA_IO_KEY;

            if (SPORTSDATA_IO_KEY) {
                // Use US Eastern time for "today" as most NCAAB games follow this cycle
                const estToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
                const sportsDataRes = await fetch(`https://api.sportsdata.io/v3/cbb/odds/json/GameOddsByDate/${estToday}`, {
                    headers: { 'Ocp-Apim-Subscription-Key': SPORTSDATA_IO_KEY },
                    next: { revalidate: 0 }
                });

                if (sportsDataRes.ok) {
                    const sportsData = await sportsDataRes.json();
                    data = mapSportsDataIOToStandard(sportsData || []);
                    source = 'SportsDataIO';
                    console.log(`SportsDataIO returned ${data.length} items.`);
                } else {
                    const errorText = await sportsDataRes.text();
                    chainErrors.push({ provider: 'SportsDataIO', status: sportsDataRes.status, details: errorText });
                    console.error("SportsDataIO also failed.");
                }
            } else {
                chainErrors.push({ provider: 'SportsDataIO', error: 'No API Key configured.' });
            }
        }

        // --- STEP 3: TheRundown Fallback (Tertiary) ---
        if (data.length === 0) {
            console.warn("Attempting TheRundown fallback...");
            const THERUNDOWN_API_KEY = process.env.THERUNDOWN_API_KEY;

            if (THERUNDOWN_API_KEY) {
                const estToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
                const rundownRes = await fetch(`https://therundown.io/api/v2/sports/5/events/${estToday}?include=all_periods`, {
                    headers: { 'X-TheRundown-Key': THERUNDOWN_API_KEY },
                    next: { revalidate: 0 }
                });

                if (rundownRes.ok) {
                    const rundownData = await rundownRes.json();
                    data = mapTheRundownToStandard(rundownData.events || []);
                    source = 'TheRundown';
                    console.log(`TheRundown returned ${data.length} items.`);
                } else {
                    const errorText = await rundownRes.text();
                    chainErrors.push({ provider: 'TheRundown', status: rundownRes.status, details: errorText });
                    console.error("TheRundown fallback failed.");
                }
            } else {
                chainErrors.push({ provider: 'TheRundown', error: 'No API Key configured.' });
            }
        }

        // --- STEP 4: API-Sports Fallback (Quaternary) ---
        if (data.length === 0) {
            console.warn("Attempting API-Sports fallback...");
            const API_SPORTS_KEY = process.env.API_SPORTS_KEY;

            if (API_SPORTS_KEY) {
                const apiSportsRes = await fetch(`https://v1.basketball.api-sports.io/odds?league=116&season=2024`, {
                    headers: { 'x-apisports-key': API_SPORTS_KEY },
                    next: { revalidate: 0 }
                });

                if (apiSportsRes.ok) {
                    const apiSportsData = await apiSportsRes.json();
                    data = mapApiSportsToStandard(apiSportsData.response || []);
                    source = 'API-Sports';
                    console.log(`API-Sports returned ${data.length} items.`);
                } else {
                    const errorText = await apiSportsRes.text();
                    chainErrors.push({ provider: 'API-Sports', status: apiSportsRes.status, details: errorText });
                    console.error("API-Sports fallback failed.");
                }
            } else {
                chainErrors.push({ provider: 'API-Sports', error: 'No API Key configured.' });
            }
        }

        if (data.length === 0) {
            return NextResponse.json({
                error: 'All odds providers failed or returned no data.',
                diagnostics: chainErrors
            }, { status: 503 });
        }
        const supabase = await createClient();

        // --- NEW: Fetch Dynamic Weights for Learning Engine ---
        const { data: weightsData } = await supabase
            .from('signal_weights')
            .select('category, weight');

        const weights = (weightsData || []).reduce((acc: Record<string, number>, curr: { category: string; weight: number }) => {
            acc[curr.category] = curr.weight;
            return acc;
        }, {} as Record<string, number>);

        // Defaults if weights table is empty
        const SPREAD_MULT = weights.spread_multiplier || 10;
        const TOP_25_BONUS = weights.top_25_bonus || 10;
        const BASE_SCORE = weights.default_base_score || 50;

        let gamesInserted = 0;
        let oddsInserted = 0;

        console.log(`Fetched ${data.length} games from ${source}`);

        for (const game of data) {
            const teamsString = `${game.away_team} @ ${game.home_team}`;
            const bookmakers = game.bookmakers;
            if (!bookmakers || bookmakers.length === 0) continue;

            const primaryBookmaker = bookmakers.find((b: Bookmaker) => b.key === 'pinnacle') || bookmakers[0];
            const spreadMarket = primaryBookmaker.markets.find((m: Market) => m.key === 'spreads');
            if (!spreadMarket || !spreadMarket.outcomes || spreadMarket.outcomes.length === 0) continue;

            const homeOutcome = spreadMarket.outcomes.find((o: Outcome) => o.name === game.home_team);
            if (!homeOutcome) continue;

            const currentSpread = homeOutcome.point ?? 0;
            const spreadPrice = homeOutcome.price;

            const { data: gameRecord, error: gameError } = await supabase
                .from('games')
                .upsert({
                    external_id: game.id,
                    teams: teamsString,
                    commence_time: game.commence_time,
                    home_rank: getTeamRank(game.home_team),
                    away_rank: getTeamRank(game.away_team),
                    // signal_side and confidence_score are usually updated by the movement analyzer
                    // but we ensure columns exist.
                    closing_spread: currentSpread
                }, { onConflict: 'external_id' })
                .select('id')
                .single();

            if (gameError || !gameRecord) continue;
            gamesInserted++;

            // Extract moneyline (h2h market)
            const h2hMarket = primaryBookmaker.markets.find((m: Market) => m.key === 'h2h');
            let mlHome: number | null = null;
            let mlAway: number | null = null;
            if (h2hMarket?.outcomes) {
                const mlHomeOutcome = h2hMarket.outcomes.find((o: Outcome) => o.name === game.home_team);
                const mlAwayOutcome = h2hMarket.outcomes.find((o: Outcome) => o.name === game.away_team);
                mlHome = mlHomeOutcome?.price ?? null;
                mlAway = mlAwayOutcome?.price ?? null;
            }

            // Extract totals
            const totalsMarket = primaryBookmaker.markets.find((m: Market) => m.key === 'totals');
            let totalPoints: number | null = null;
            let overPrice: number | null = null;
            let underPrice: number | null = null;
            if (totalsMarket?.outcomes) {
                const overOutcome = totalsMarket.outcomes.find((o: Outcome) => o.name === 'Over');
                const underOutcome = totalsMarket.outcomes.find((o: Outcome) => o.name === 'Under');
                totalPoints = overOutcome?.point ?? null;
                overPrice = overOutcome?.price ?? null;
                underPrice = underOutcome?.price ?? null;
            }

            const { count } = await supabase
                .from('odds_snapshots')
                .select('*', { count: 'exact', head: true })
                .eq('game_id', gameRecord.id);

            const isOpeningLine = count === 0;

            const { error: oddsError } = await supabase
                .from('odds_snapshots')
                .insert({
                    game_id: gameRecord.id,
                    bookmaker: primaryBookmaker.title,
                    spread: currentSpread,
                    spread_price: spreadPrice,
                    moneyline_home: mlHome,
                    moneyline_away: mlAway,
                    total_points: totalPoints,
                    over_price: overPrice,
                    under_price: underPrice,
                    is_opening_line: isOpeningLine
                });

            if (!oddsError) oddsInserted++;

            // RE-CALCULATE CONFIDENCE & SIGNAL AFTER INSERTING SNAPSHOT
            // This ensures every sync refreshes the "Sharp" status based on movement
            const { data: snapshots } = await supabase
                .from('odds_snapshots')
                .select('spread, is_opening_line')
                .eq('game_id', gameRecord.id)
                .order('timestamp', { ascending: true });

            if (snapshots && snapshots.length >= 2) {
                const opening = snapshots.find(s => s.is_opening_line) || snapshots[0];
                const current = snapshots[snapshots.length - 1];
                const delta = current.spread - opening.spread;

                if (Math.abs(delta) >= 1.0) {
                    let side: 'home' | 'away' | null = null;
                    if (current.spread < 0) {
                        side = delta > 0 ? 'away' : 'home';
                    } else {
                        side = delta > 0 ? 'home' : 'away';
                    }

                    let score = BASE_SCORE;
                    score += Math.floor(Math.abs(delta) * SPREAD_MULT);
                    if (getTeamRank(game.home_team) || getTeamRank(game.away_team)) score += TOP_25_BONUS;

                    await supabase.from('games').update({
                        signal_side: side,
                        confidence_score: Math.min(98, score)
                    }).eq('id', gameRecord.id);
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Odds updated.',
            stats: { gamesProcessed: gamesInserted, oddsSnapshotsInserted: oddsInserted }
        });

    } catch (error: unknown) {
        console.error("CRITICAL API ERROR:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// --- EXTERNAL API INTERFACES ---

interface SportsDataIOOdds {
    Sportsbook: string;
    HomePointSpread: number | null;
    HomePointSpreadPayout: number | null;
    AwayPointSpread: number | null;
    AwayPointSpreadPayout: number | null;
    HomeMoneyLine: number | null;
    AwayMoneyLine: number | null;
    OverUnder: number | null;
    OverPayout: number | null;
    UnderPayout: number | null;
}

interface SportsDataIOGame {
    GameID: number;
    DateTime: string;
    HomeTeamName: string;
    AwayTeamName: string;
    PregameOdds: SportsDataIOOdds[];
}

interface ApiSportsOutcome {
    value: string;
    odd: string;
}

interface ApiSportsBet {
    name: string;
    values: ApiSportsOutcome[];
}

interface ApiSportsBookmaker {
    name: string;
    bets: ApiSportsBet[];
}

interface ApiSportsGame {
    game: { id: number; date: string };
    teams: { home: { name: string }; away: { name: string } };
    bookmakers: ApiSportsBookmaker[];
}

interface RundownLine {
    spread?: { affiliate_home_odds: number; point_spread_home: number; affiliate_away_odds: number; point_spread_away: number };
    moneyline?: { moneyline_home: number; moneyline_away: number };
    total?: { total_over_odds: number; total_under_odds: number; total_over: number };
}

interface RundownTeam {
    name: string;
    is_home: boolean;
}

interface RundownEvent {
    event_id: string;
    event_date: string;
    teams_normalized?: RundownTeam[];
    teams?: { name: string }[];
    lines?: Record<string, RundownLine>;
}

/**
 * Normalizes SportsDataIO CBB Odds data to match The Odds API structure
 */
function mapSportsDataIOToStandard(response: SportsDataIOGame[]): StandardGame[] {
    if (!Array.isArray(response)) {
        console.error("SportsDataIO returned non-array response:", response);
        return [];
    }

    return response.map(item => {
        const bookmakers = (item.PregameOdds || []).map((odds: SportsDataIOOdds) => {
            const markets: Market[] = [];

            if (!odds || !odds.Sportsbook) return null;

            // Spread Market
            if (odds.HomePointSpread !== null && odds.HomePointSpread !== undefined) {
                markets.push({
                    key: 'spreads',
                    outcomes: [
                        { name: item.HomeTeamName || 'Home', price: americanToDecimal(odds.HomePointSpreadPayout), point: odds.HomePointSpread },
                        { name: item.AwayTeamName || 'Away', price: americanToDecimal(odds.AwayPointSpreadPayout), point: odds.AwayPointSpread }
                    ]
                });
            }

            // H2H Market
            if (odds.HomeMoneyLine !== null && odds.HomeMoneyLine !== undefined) {
                markets.push({
                    key: 'h2h',
                    outcomes: [
                        { name: item.HomeTeamName || 'Home', price: americanToDecimal(odds.HomeMoneyLine), point: null },
                        { name: item.AwayTeamName || 'Away', price: americanToDecimal(odds.AwayMoneyLine), point: null }
                    ]
                });
            }

            // Totals Market
            if (odds.OverUnder !== null && odds.OverUnder !== undefined) {
                markets.push({
                    key: 'totals',
                    outcomes: [
                        { name: 'Over', price: americanToDecimal(odds.OverPayout), point: odds.OverUnder },
                        { name: 'Under', price: americanToDecimal(odds.UnderPayout), point: odds.OverUnder }
                    ]
                });
            }

            return {
                key: odds.Sportsbook.toLowerCase().replace(/\s+/g, ''),
                title: odds.Sportsbook,
                markets: markets
            };
        }).filter((b: Bookmaker | null): b is Bookmaker => b !== null);

        return {
            id: `sportsdata-${item.GameID || Math.random()}`,
            commence_time: item.DateTime || new Date().toISOString(),
            home_team: item.HomeTeamName || 'Unknown Home',
            away_team: item.AwayTeamName || 'Unknown Away',
            bookmakers: bookmakers
        };
    });
}

/**
 * Normalizes API-Sports basketball odds data to match The Odds API structure
 */
function mapApiSportsToStandard(response: ApiSportsGame[]): StandardGame[] {
    if (!Array.isArray(response)) return [];

    return response.map(item => {
        const bookmakers: Bookmaker[] = (item.bookmakers || []).map((b: ApiSportsBookmaker) => ({
            key: b.name.toLowerCase().replace(/\s+/g, ''),
            title: b.name,
            markets: (b.bets || []).map((bet: ApiSportsBet) => {
                let marketKey = '';
                if (bet.name === 'Home/Away') marketKey = 'h2h';
                if (bet.name === 'Handicap' || bet.name === 'Spread') marketKey = 'spreads';
                if (bet.name === 'Total points' || bet.name === 'Over/Under') marketKey = 'totals';

                return {
                    key: marketKey,
                    outcomes: (bet.values || []).map((v: ApiSportsOutcome) => {
                        const pointMatch = v.value.match(/([+-]?\d+\.?\d*)/);
                        const point = pointMatch ? parseFloat(pointMatch[1]) : null;

                        let name = v.value;
                        if (v.value.toLowerCase().includes('home')) name = item.teams.home.name;
                        if (v.value.toLowerCase().includes('away')) name = item.teams.away.name;

                        return {
                            name: name,
                            price: parseFloat(v.odd),
                            point: point
                        };
                    })
                };
            }).filter((m: Market) => m.key !== '')
        }));

        return {
            id: `apisports-${item.game.id}`,
            commence_time: item.game.date,
            home_team: item.teams.home.name,
            away_team: item.teams.away.name,
            bookmakers: bookmakers
        };
    });
}

/**
 * Normalizes TheRundown CBB Odds data to match The Odds API structure
 * Sport ID 5 is NCAAB
 */
function mapTheRundownToStandard(events: RundownEvent[]): StandardGame[] {
    if (!Array.isArray(events)) return [];

    return events.map(event => {
        const bookmakers: Bookmaker[] = [];

        // TheRundown provides lines by sportsbook ID in a lines object
        // 1: Pinnacle, 3: FanDuel, 7: DraftKings, etc.
        if (event.lines) {
            for (const [sbId, line] of Object.entries(event.lines) as [string, RundownLine][]) {
                const markets: Market[] = [];

                // Spread
                if (line.spread) {
                    markets.push({
                        key: 'spreads',
                        outcomes: [
                            { name: event.teams_normalized?.[0]?.name || event.teams?.[0]?.name || 'Home', price: americanToDecimal(line.spread.affiliate_home_odds), point: line.spread.point_spread_home },
                            { name: event.teams_normalized?.[1]?.name || event.teams?.[1]?.name || 'Away', price: americanToDecimal(line.spread.affiliate_away_odds), point: line.spread.point_spread_away }
                        ]
                    });
                }

                // Moneyline
                if (line.moneyline) {
                    markets.push({
                        key: 'h2h',
                        outcomes: [
                            { name: event.teams_normalized?.[0]?.name || event.teams?.[0]?.name || 'Home', price: americanToDecimal(line.moneyline.moneyline_home) },
                            { name: event.teams_normalized?.[1]?.name || event.teams?.[1]?.name || 'Away', price: americanToDecimal(line.moneyline.moneyline_away) }
                        ]
                    });
                }

                // Totals
                if (line.total) {
                    markets.push({
                        key: 'totals',
                        outcomes: [
                            { name: 'Over', price: americanToDecimal(line.total.total_over_odds), point: line.total.total_over },
                            { name: 'Under', price: americanToDecimal(line.total.total_under_odds), point: line.total.total_over }
                        ]
                    });
                }

                if (markets.length > 0) {
                    bookmakers.push({
                        key: `rundown-${sbId}`,
                        title: getSportsbookName(sbId),
                        markets: markets
                    });
                }
            }
        }

        return {
            id: `rundown-${event.event_id}`,
            commence_time: event.event_date,
            home_team: event.teams_normalized?.find((t: RundownTeam) => t.is_home)?.name || event.teams?.[0]?.name || 'Unknown Home',
            away_team: event.teams_normalized?.find((t: RundownTeam) => !t.is_home)?.name || event.teams?.[1]?.name || 'Unknown Away',
            bookmakers: bookmakers
        };
    });
}

function getSportsbookName(id: string): string {
    const names: Record<string, string> = {
        '1': 'Pinnacle',
        '2': '5Dimes',
        '3': 'FanDuel',
        '4': 'BetOnline',
        '7': 'DraftKings',
        '8': 'Bovada',
        '9': 'LowVig'
    };
    return names[id] || `Sportsbook ${id}`;
}

function americanToDecimal(american: string | number | null | undefined): number {
    if (american === null || american === undefined || american === 0) return 1.91;
    const odds = typeof american === 'string' ? parseFloat(american) : american;
    if (isNaN(odds)) return 1.91;

    if (odds > 0) {
        return (odds / 100) + 1;
    } else {
        return (100 / Math.abs(odds)) + 1;
    }
}
