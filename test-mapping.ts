import { mapSportsDataIOToStandard } from './src/app/api/fetch-odds/route'; // I'll need to export it or move it

// For testing, I'll just copy the function here
function americanToDecimal(american: any): number {
    if (american === null || american === undefined || american === 0) return 1.91;
    const odds = typeof american === 'string' ? parseFloat(american) : american;
    if (isNaN(odds)) return 1.91;

    if (odds > 0) {
        return (odds / 100) + 1;
    } else {
        return (100 / Math.abs(odds)) + 1;
    }
}

function mapSportsDataIOToStandard(response: any): any[] {
    if (!Array.isArray(response)) {
        console.error("SportsDataIO returned non-array response:", response);
        return [];
    }

    return response.map(item => {
        const bookmakers = (item.PregameOdds || []).map((odds: any) => {
            const markets = [];

            if (!odds || !odds.Sportsbook) return null;

            if (odds.HomePointSpread !== null && odds.HomePointSpread !== undefined) {
                markets.push({
                    key: 'spreads',
                    outcomes: [
                        { name: item.HomeTeamName || 'Home', price: americanToDecimal(odds.HomePointSpreadPayout), point: odds.HomePointSpread },
                        { name: item.AwayTeamName || 'Away', price: americanToDecimal(odds.AwayPointSpreadPayout), point: odds.AwayPointSpread }
                    ]
                });
            }

            if (odds.HomeMoneyLine !== null && odds.HomeMoneyLine !== undefined) {
                markets.push({
                    key: 'h2h',
                    outcomes: [
                        { name: item.HomeTeamName || 'Home', price: americanToDecimal(odds.HomeMoneyLine) },
                        { name: item.AwayTeamName || 'Away', price: americanToDecimal(odds.AwayMoneyLine) }
                    ]
                });
            }

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
        }).filter(Boolean);

        return {
            id: `sportsdata-${item.GameID || Math.random()}`,
            commence_time: item.DateTime || new Date().toISOString(),
            home_team: item.HomeTeamName || 'Unknown Home',
            away_team: item.AwayTeamName || 'Unknown Away',
            bookmakers: bookmakers
        };
    });
}

// Mock data
const mockData = [
    {
        GameID: 101,
        DateTime: "2026-02-28T19:00:00",
        HomeTeamName: "Duke",
        AwayTeamName: "Virginia",
        PregameOdds: [
            {
                Sportsbook: "DraftKings",
                HomePointSpread: -7.5,
                AwayPointSpread: 7.5,
                HomePointSpreadPayout: -110,
                AwayPointSpreadPayout: -110
            }
        ]
    }
];

try {
    const result = mapSportsDataIOToStandard(mockData);
    console.log("Mapping Success:", JSON.stringify(result, null, 2));
} catch (e) {
    console.error("Mapping Failed:", e);
}
