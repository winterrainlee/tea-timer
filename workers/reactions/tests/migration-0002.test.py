#!/usr/bin/env python3
"""Acceptance test for the deployed 0001 -> 0002 SQLite migration path."""

import sqlite3
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OLD = (ROOT / "migrations" / "0001_creator_feedback.sql").read_text()
MIGRATION = (ROOT / "migrations" / "0002_messages_zh_cn.sql").read_text()


def must_fail(connection, statement, parameters=()):
    try:
        connection.execute(statement, parameters)
    except sqlite3.IntegrityError:
        return
    raise AssertionError(f"expected constraint failure: {statement}")


def migrate(seed):
    directory = tempfile.TemporaryDirectory()
    database = Path(directory.name) / "migration.sqlite"
    connection = sqlite3.connect(database)
    connection.executescript(OLD)
    seed(connection)
    connection.commit()
    connection.executescript(MIGRATION)
    return directory, connection


def seed_preserved_rows(connection):
    connection.execute("INSERT INTO messages (request_id, message, locale, created_at) VALUES (?, ?, ?, ?)", ("11111111-1111-4111-8111-111111111111", "한국어 원문", "ko", "2026-08-01T01:02:03.004Z"))
    connection.execute("INSERT INTO messages (request_id, message, locale, created_at) VALUES (?, ?, ?, ?)", ("22222222-2222-4222-8222-222222222222", "繁體原文", "zh-TW", "2026-08-02T01:02:03.004Z"))
    connection.execute("INSERT INTO messages (request_id, message, locale, created_at) VALUES (?, ?, ?, ?)", ("33333333-3333-4333-8333-333333333333", "deleted high-water", "ko", "2026-08-03T01:02:03.004Z"))
    connection.execute("DELETE FROM messages WHERE id = 3")


directory, connection = migrate(seed_preserved_rows)
try:
    before_sequence = 3
    records = connection.execute("SELECT id, request_id, message, locale, created_at FROM messages ORDER BY id").fetchall()
    assert records == [
        (1, "11111111-1111-4111-8111-111111111111", "한국어 원문", "ko", "2026-08-01T01:02:03.004Z"),
        (2, "22222222-2222-4222-8222-222222222222", "繁體原文", "zh-TW", "2026-08-02T01:02:03.004Z"),
    ]
    after_sequence = connection.execute("SELECT seq FROM sqlite_sequence WHERE name = 'messages'").fetchone()[0]
    assert after_sequence == before_sequence == 3
    assert connection.execute("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'idx_messages_created_at'").fetchone()
    must_fail(connection, "INSERT INTO messages (request_id, message, locale) VALUES (?, ?, ?)", (records[0][1], "duplicate", "ko"))
    must_fail(connection, "INSERT INTO messages (request_id, message, locale) VALUES (?, ?, ?)", ("44444444-4444-4444-8444-444444444444", "unsupported", "en"))
    connection.execute("INSERT INTO messages (request_id, message, locale) VALUES (?, ?, ?)", ("55555555-5555-4555-8555-555555555555", "简体原文", "zh-CN"))
    zh_cn_row = connection.execute("SELECT id, locale FROM messages WHERE request_id = ?", ("55555555-5555-4555-8555-555555555555",)).fetchone()
    assert zh_cn_row == (4, "zh-CN")
finally:
    connection.close()
    directory.cleanup()


def seed_all_rows_deleted(connection):
    connection.execute("INSERT INTO messages (request_id, message, locale) VALUES ('77777777-7777-4777-8777-777777777777', 'deleted', 'ko')")
    connection.execute("DELETE FROM messages")


edge_cases = []
for label, seed, expected_id, expected_sequence in [
    ("no_rows_ever", lambda connection: None, 1, None),
    ("all_rows_deleted", seed_all_rows_deleted, 2, 1),
]:
    directory, connection = migrate(seed)
    try:
        if expected_sequence is not None:
            assert connection.execute("SELECT seq FROM sqlite_sequence WHERE name = 'messages'").fetchone()[0] == expected_sequence
        connection.execute("INSERT INTO messages (request_id, message, locale) VALUES (?, ?, ?)", (f"new-{expected_id}", "new", "zh-CN"))
        assert connection.execute("SELECT id FROM messages WHERE request_id = ?", (f"new-{expected_id}",)).fetchone()[0] == expected_id
        edge_cases.append((label, expected_id))
    finally:
        connection.close()
        directory.cleanup()

print({"preserved_rows": records, "sequence_before": before_sequence, "sequence_after": after_sequence, "zh_cn_row": zh_cn_row, "edge_cases": edge_cases})
