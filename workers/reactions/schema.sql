CREATE TABLE IF NOT EXISTS reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app TEXT NOT NULL DEFAULT 'tea-timer',
  reaction TEXT NOT NULL CHECK (reaction IN ('clap', 'down')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reactions_created_at
ON reactions(created_at);

CREATE INDEX IF NOT EXISTS idx_reactions_reaction
ON reactions(reaction);
