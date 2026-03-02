-- Add Handle vs. Ticket metrics and Market Maker counting support
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS handle_pct_home NUMERIC,
ADD COLUMN IF NOT EXISTS ticket_pct_home NUMERIC,
ADD COLUMN IF NOT EXISTS market_maker_count INTEGER DEFAULT 0;

-- Index for performance on large datasets
CREATE INDEX IF NOT EXISTS idx_games_handle_gap ON games (handle_pct_home, ticket_pct_home);
