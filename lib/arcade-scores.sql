CREATE TABLE IF NOT EXISTS score_players (
  id text PRIMARY KEY,
  realm text NOT NULL CHECK (realm IN ('badge','web')),
  name text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS score_player_name ON score_players (realm, lower(name));

CREATE TABLE IF NOT EXISTS score_requests (
  id text PRIMARY KEY,
  expires bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS score_records (
  player text NOT NULL REFERENCES score_players(id),
  game text NOT NULL,
  cohort text NOT NULL CHECK (cohort IN ('badge','mobile','desktop')),
  ruleset text NOT NULL,
  board integer NOT NULL,
  score integer NOT NULL,
  receipt text NOT NULL,
  updated timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player, game, cohort, ruleset)
);
CREATE INDEX IF NOT EXISTS score_partition ON score_records (game, cohort, ruleset, board DESC);
