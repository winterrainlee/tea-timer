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

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  message TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('ko', 'zh-TW')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
