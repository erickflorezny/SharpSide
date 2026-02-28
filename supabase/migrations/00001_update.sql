-- Run this if you already created the tables but they are missing the recent changes:

-- 1. Add external_id to games
ALTER TABLE games ADD COLUMN IF NOT EXISTS external_id TEXT;
-- We need to populate existing rows with a dummy value before adding the UNIQUE NOT NULL constraint if there's data,
-- but assuming it's empty, we can just alter it:
ALTER TABLE games ALTER COLUMN external_id SET NOT NULL;
ALTER TABLE games ADD CONSTRAINT games_external_id_key UNIQUE (external_id);

-- 2. Ensure odds_snapshots has the correct spread column 
-- (The error indicated odds_snapshots_1.spread does not exist)
ALTER TABLE odds_snapshots ADD COLUMN IF NOT EXISTS spread NUMERIC NOT NULL DEFAULT 0;

-- 3. (Optional) Re-create indexes if missing
CREATE INDEX IF NOT EXISTS idx_games_commence_time ON games(commence_time);
CREATE INDEX IF NOT EXISTS idx_odds_game_is_opening ON odds_snapshots(game_id, is_opening_line);
