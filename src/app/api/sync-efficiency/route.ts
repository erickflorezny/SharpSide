import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
    try {
        const supabase = await createClient();

        // 1. Fetch Torvik Efficiency Data (2026 Season)
        const TORVIK_URL = 'https://barttorvik.com/2026_team_results.json';
        const response = await fetch(TORVIK_URL);

        if (!response.ok) {
            throw new Error(`Torvik API failed: ${response.statusText}`);
        }

        const data: any[][] = await response.json();

        // 2. Parse and Upsert
        const upsertData = data.map(team => ({
            team_name: team[1],
            conference: team[2],
            record: team[3],
            adj_oe: team[4],
            adj_oe_rank: team[5],
            adj_de: team[6],
            adj_de_rank: team[7],
            barthag: team[8],
            barthag_rank: team[9],
            adj_tempo: team[team.length - 1], // Tempo is last
            last_updated: new Date().toISOString()
        }));

        // Use a standard upsert. If the table doesn't exist, this will fail.
        // We assume the table is created via migrations or manual SQL.
        const { error } = await supabase
            .from('team_efficiency')
            .upsert(upsertData, { onConflict: 'team_name' });

        if (error) {
            console.error('Supabase Upsert Error:', error);
            return NextResponse.json({
                success: false,
                error: error.message,
                hint: "Ensure the 'team_efficiency' table exists in Supabase. Check migrations/00004_efficiency.sql"
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `Efficiency data synced for ${upsertData.length} teams.`,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('Efficiency Sync Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
