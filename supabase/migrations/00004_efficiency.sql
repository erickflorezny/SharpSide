-- Create team_efficiency table for storing Torvik metrics
CREATE TABLE IF NOT EXISTS team_efficiency (
  team_name TEXT PRIMARY KEY,
  conference TEXT,
  record TEXT,
  adj_oe NUMERIC,
  adj_oe_rank INTEGER,
  adj_de NUMERIC,
  adj_de_rank INTEGER,
  barthag NUMERIC,
  barthag_rank INTEGER,
  adj_tempo NUMERIC,
  adj_tempo_rank INTEGER,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (if needed, but for now we'll just allow all internal access)
-- ALTER TABLE team_efficiency ENABLE ROW LEVEL SECURITY;

-- Add efficiency columns to games table for quick reference in joined queries
ALTER TABLE games ADD COLUMN IF NOT EXISTS home_efficiency_rank INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS away_efficiency_rank INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS win_probability NUMERIC;
