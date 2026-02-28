// AP Top 25 College Basketball Rankings
// Source: AP Poll, February 25, 2026
// Update this file weekly during the season.

// Maps common team name variations (as they appear in The Odds API) to their AP rank.
// The Odds API uses full team names like "Duke Blue Devils", "Arizona Wildcats", etc.
export const AP_TOP_25: Record<string, number> = {
    // #1 Duke
    'Duke Blue Devils': 1,
    'Duke': 1,

    // #2 Michigan
    'Michigan Wolverines': 2,
    'Michigan': 2,

    // #3 Arizona
    'Arizona Wildcats': 3,
    'Arizona': 3,

    // #4 Florida
    'Florida Gators': 4,
    'Florida': 4,

    // #5 Illinois
    'Illinois Fighting Illini': 5,
    'Illinois': 5,

    // #6 Iowa State
    'Iowa State Cyclones': 6,
    'Iowa State': 6,

    // #7 Houston
    'Houston Cougars': 7,
    'Houston': 7,

    // #8 UConn
    'UConn Huskies': 8,
    'Connecticut Huskies': 8,
    'UConn': 8,

    // #9 Purdue
    'Purdue Boilermakers': 9,
    'Purdue': 9,

    // #10 Gonzaga
    'Gonzaga Bulldogs': 10,
    'Gonzaga': 10,

    // #11 Virginia
    'Virginia Cavaliers': 11,
    'Virginia': 11,

    // #12 Nebraska
    'Nebraska Cornhuskers': 12,
    'Nebraska': 12,

    // #13 Michigan State
    'Michigan State Spartans': 13,
    'Michigan State': 13,
    'Michigan St Spartans': 13,

    // #14 Kansas
    'Kansas Jayhawks': 14,
    'Kansas': 14,

    // #15 St. John\'s
    "St. John's Red Storm": 15,
    "St John's Red Storm": 15,
    "St. John's": 15,

    // #16 Texas Tech
    'Texas Tech Red Raiders': 16,
    'Texas Tech': 16,

    // #17 Alabama
    'Alabama Crimson Tide': 17,
    'Alabama': 17,

    // #18 North Carolina
    'North Carolina Tar Heels': 18,
    'North Carolina': 18,
    'UNC': 18,

    // #19 BYU
    'BYU Cougars': 19,
    'BYU': 19,
    'Brigham Young Cougars': 19,

    // #20 Arkansas
    'Arkansas Razorbacks': 20,
    'Arkansas': 20,

    // #21 Miami (OH)
    'Miami (OH) RedHawks': 21,
    'Miami OH RedHawks': 21,
    'Miami Ohio': 21,
    'Miami (OH)': 21,

    // #22 Tennessee
    'Tennessee Volunteers': 22,
    'Tennessee': 22,

    // #23 Saint Louis
    'Saint Louis Billikens': 23,
    'Saint Louis': 23,

    // #24 Louisville
    'Louisville Cardinals': 24,
    'Louisville': 24,

    // #25 Vanderbilt
    'Vanderbilt Commodores': 25,
    'Vanderbilt': 25,
};

/**
 * Look up a team's AP rank.
 * Returns the rank (1-25) or null if unranked.
 */
export function getTeamRank(teamName: string): number | null {
    return AP_TOP_25[teamName] ?? null;
}
