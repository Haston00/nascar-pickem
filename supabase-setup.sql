-- NASCAR Pick'em Tables
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor

CREATE TABLE nascar_picks (
  id SERIAL PRIMARY KEY,
  player TEXT NOT NULL,
  race_id INTEGER NOT NULL,
  driver TEXT NOT NULL,
  driver_num TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player, race_id)
);

CREATE TABLE nascar_results (
  id SERIAL PRIMARY KEY,
  race_id INTEGER NOT NULL UNIQUE,
  finish_order JSONB DEFAULT '[]',
  winner TEXT,
  race_winner TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow public read/write (simple family app, no auth needed)
ALTER TABLE nascar_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE nascar_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access picks" ON nascar_picks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access results" ON nascar_results FOR ALL USING (true) WITH CHECK (true);
