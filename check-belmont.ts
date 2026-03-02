import { createClient } from './src/utils/supabase/server';

async function checkBelmont() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('games')
        .select('*')
        .ilike('teams', '%Belmont%')
        .order('commence_time', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching game:', error);
        return;
    }

    console.log(JSON.stringify(data, null, 2));
}

checkBelmont();
