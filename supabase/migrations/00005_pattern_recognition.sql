-- Add Pattern Recognition columns to games table
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS delta_category TEXT,
ADD COLUMN IF NOT EXISTS is_cross_zero BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_golden_rule BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS conference_type TEXT;

-- Indexing for pattern-based filtering
CREATE INDEX IF NOT EXISTS idx_games_patterns ON games (delta_category, is_cross_zero, is_golden_rule);
