-- Add columns for performance tracking and confidence scoring
ALTER TABLE games ADD COLUMN IF NOT EXISTS signal_side TEXT; -- 'home' or 'away'
ALTER TABLE games ADD COLUMN IF NOT EXISTS confidence_score INTEGER DEFAULT 50;
ALTER TABLE games ADD COLUMN IF NOT EXISTS result_win BOOLEAN; -- NULL = pending, TRUE = win, FALSE = loss
ALTER TABLE games ADD COLUMN IF NOT EXISTS closing_spread NUMERIC;
