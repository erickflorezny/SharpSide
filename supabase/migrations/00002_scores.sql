-- Add score and game status columns to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS home_score INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS away_score INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_status TEXT DEFAULT 'upcoming'; -- 'upcoming', 'live', 'final'
ALTER TABLE games ADD COLUMN IF NOT EXISTS last_score_update TIMESTAMPTZ;
