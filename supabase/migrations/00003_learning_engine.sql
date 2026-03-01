-- Create table for storing dynamic weights
CREATE TABLE IF NOT EXISTS signal_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT UNIQUE NOT NULL, -- e.g., 'spread_multiplier', 'top_25_bonus', 'home_fav_bonus'
  weight NUMERIC NOT NULL,
  last_tuned TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial weights (current baseline)
INSERT INTO signal_weights (category, weight)
VALUES 
  ('spread_multiplier', 10.0),
  ('top_25_bonus', 10.0),
  ('default_base_score', 50.0)
ON CONFLICT (category) DO NOTHING;

-- Create a view to analyze signal performance
-- This helps the 'learning' endpoint decide if weights need adjustment
CREATE OR REPLACE VIEW signal_performance AS
SELECT 
  confidence_score / 10 * 10 as score_bracket,
  COUNT(*) as total_signals,
  COUNT(*) FILTER (WHERE result_win = true) as total_wins,
  ROUND(CAST(COUNT(*) FILTER (WHERE result_win = true) AS NUMERIC) / NULLIF(COUNT(*), 0), 3) as win_rate
FROM games
WHERE game_status = 'final'
  AND result_win IS NOT NULL
GROUP BY 1
ORDER BY score_bracket DESC;
