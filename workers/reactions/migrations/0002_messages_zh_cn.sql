-- SQLite cannot alter a CHECK constraint. Rebuild messages while retaining every
-- existing value and the sqlite_sequence high-water mark used by AUTOINCREMENT.
CREATE TABLE _messages_0002_sequence (
  seq INTEGER NOT NULL
);
INSERT INTO _messages_0002_sequence (seq)
SELECT seq FROM sqlite_sequence WHERE name = 'messages';

CREATE TABLE messages_0002 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  message TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('ko', 'zh-TW', 'zh-CN')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT INTO messages_0002 (id, request_id, message, locale, created_at)
SELECT id, request_id, message, locale, created_at FROM messages;

DROP TABLE messages;
ALTER TABLE messages_0002 RENAME TO messages;
CREATE INDEX idx_messages_created_at ON messages(created_at);

DELETE FROM sqlite_sequence WHERE name = 'messages';
INSERT INTO sqlite_sequence (name, seq)
SELECT 'messages', CASE
  WHEN seq > COALESCE((SELECT MAX(id) FROM messages), 0) THEN seq
  ELSE COALESCE((SELECT MAX(id) FROM messages), 0)
END
FROM _messages_0002_sequence;
DROP TABLE _messages_0002_sequence;
