CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE NOT NULL,
  teams TEXT NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  home_rank INTEGER,
  away_rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE odds_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  bookmaker TEXT NOT NULL,
  spread NUMERIC NOT NULL,
  is_opening_line BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying
CREATE INDEX idx_games_commence_time ON games(commence_time);
CREATE INDEX idx_odds_game_is_opening ON odds_snapshots(game_id, is_opening_line);
