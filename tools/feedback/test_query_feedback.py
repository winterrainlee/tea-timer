import datetime as dt
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import query_feedback


def msg(i, text="body", created=None):
    return {"id": i, "message": text, "locale": "ko", "created_at": created or dt.datetime.now(dt.timezone.utc).isoformat()}


class FakeOpener:
    def __init__(self, pages):
        self.pages = iter(pages)
        self.requests = []

    def __call__(self, request, timeout=0):
        self.requests.append(request)
        payload = next(self.pages)
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, size=-1): return json.dumps(payload).encode()[:size]
        return Response()


class FeedbackTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_pagination_saves_each_batch_and_cursor(self):
        fake = FakeOpener([
            {"ok": True, "messages": [msg(1)], "nextCursor": 1, "hasMore": True},
            {"ok": True, "messages": [msg(2)], "nextCursor": 2, "hasMore": False},
        ])
        result = query_feedback.sync(self.root, "http://127.0.0.1:8787/admin/messages", "secret", 50, opener=fake)
        self.assertEqual(result["saved"], 2)
        state = query_feedback.load_state(self.root)
        self.assertEqual(state["cursor"], 2)
        self.assertEqual([m["id"] for m in state["messages"]], [1, 2])
        self.assertIn("after=1", fake.requests[1].full_url)

    def test_retry_keeps_cursor_when_next_request_fails(self):
        fake = FakeOpener([{"ok": True, "messages": [msg(1)], "nextCursor": 1, "hasMore": True}])
        with patch.object(query_feedback, "fetch_page", side_effect=[query_feedback.fetch_page("http://127.0.0.1:8787/admin/messages", "x", opener=fake), query_feedback.FeedbackError("feedback request failed")]):
            with self.assertRaises(query_feedback.FeedbackError): query_feedback.sync(self.root, "http://127.0.0.1:8787/admin/messages", "x", 50)
        self.assertEqual(query_feedback.load_state(self.root)["cursor"], 1)

    def test_expired_messages_are_removed_before_failed_fetch(self):
        old = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=91)).isoformat()
        query_feedback.save_state(self.root, {"cursor": 4, "messages": [msg(4, created=old)], "acknowledged": []})
        with patch.object(query_feedback, "fetch_page", side_effect=query_feedback.FeedbackError("feedback request failed")) as fetch:
            with self.assertRaises(query_feedback.FeedbackError):
                query_feedback.sync(self.root, "http://127.0.0.1:8787/admin/messages", "x", 50)
        fetch.assert_called_once()
        state = query_feedback.load_state(self.root)
        self.assertEqual(state["messages"], [])
        self.assertEqual(state["cursor"], 4)

    def test_ack_and_retention(self):
        old = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=91)).isoformat()
        query_feedback.save_state(self.root, {"cursor": 1, "messages": [msg(1, created=old), msg(2)], "acknowledged": []})
        self.assertEqual(query_feedback.main(["--root", str(self.root), "pending"]), 0)
        state = query_feedback.load_state(self.root)
        self.assertEqual([m["id"] for m in state["messages"]], [2])
        self.assertEqual(query_feedback.main(["--root", str(self.root), "ack", "2", "999"]), 0)
        self.assertEqual(query_feedback.load_state(self.root)["acknowledged"], [2])

    def test_corrupt_state_and_bad_endpoint_are_safe(self):
        path = query_feedback.state_path(self.root)
        path.parent.mkdir(parents=True)
        path.write_text("{}", encoding="utf-8")
        with self.assertRaises(query_feedback.FeedbackError): query_feedback.load_state(self.root)
        with self.assertRaises(query_feedback.FeedbackError): query_feedback.endpoint_url("http://example.com/admin/messages")
        with self.assertRaises(query_feedback.FeedbackError): query_feedback.endpoint_url("http://127.0.0.1:8787/admin/messages?token=secret")

    def test_invalid_response_does_not_replace_existing_state(self):
        original = {"cursor": 7, "messages": [msg(7)], "acknowledged": []}
        query_feedback.save_state(self.root, original)
        fake = FakeOpener([{"ok": True, "messages": [msg(8, created="2026-08-31T00:00:00")], "nextCursor": 8, "hasMore": False}])
        with self.assertRaises(query_feedback.FeedbackError): query_feedback.sync(self.root, "http://127.0.0.1:8787/admin/messages", "x", 50, opener=fake)
        self.assertEqual(query_feedback.load_state(self.root), original)

    def test_page_contract_rejects_bool_or_non_increasing_ids(self):
        for items in ([[msg(True)], [msg(2), msg(2)]]):
            fake = FakeOpener([{"ok": True, "messages": items, "nextCursor": 2, "hasMore": False}])
            with self.assertRaises(query_feedback.FeedbackError):
                query_feedback.fetch_page("http://127.0.0.1:8787/admin/messages", "x", opener=fake)

    def test_default_opener_rejects_redirect_before_forwarding_token(self):
        request = query_feedback.Request("http://127.0.0.1:8787/admin/messages", headers={"Authorization": "Bearer secret"})
        with self.assertRaises(query_feedback.FeedbackError):
            query_feedback._RejectRedirect().redirect_request(request, object(), 302, "Found", {}, "http://127.0.0.1:9999/final")

    def test_malformed_cursor_never_skips_messages(self):
        original = {"cursor": 7, "messages": [msg(7)], "acknowledged": []}
        for payload in [
            {"ok": True, "messages": [], "nextCursor": 100, "hasMore": True},
            {"ok": True, "messages": [msg(8)], "nextCursor": 100, "hasMore": False},
            {"ok": True, "messages": [msg(8)], "nextCursor": 8, "hasMore": "false"},
        ]:
            query_feedback.save_state(self.root, original)
            with self.assertRaises(query_feedback.FeedbackError):
                query_feedback.sync(self.root, "http://127.0.0.1:8787/admin/messages", "x", 50, opener=FakeOpener([payload]))
            self.assertEqual(query_feedback.load_state(self.root), original)

    def test_storage_failure_never_fetches(self):
        with patch.object(query_feedback, "save_state", side_effect=OSError("full")), patch.object(query_feedback, "fetch_page") as fetch:
            with self.assertRaises(OSError):
                query_feedback.sync(self.root, "http://127.0.0.1:8787/admin/messages", "x", 50)
            fetch.assert_not_called()

    def test_userinfo_endpoint_is_rejected_before_network(self):
        fake = FakeOpener([])
        with self.assertRaises(query_feedback.FeedbackError):
            query_feedback.fetch_page("http://user:password@127.0.0.1:8787/admin/messages", "x", opener=fake)
        self.assertEqual(fake.requests, [])

    def test_controls_are_json_escaped(self):
        fake = FakeOpener([{"ok": True, "messages": [msg(1, "x\u0000\n\ud83c\udf75")], "nextCursor": 1, "hasMore": False}])
        page = query_feedback.fetch_page("http://127.0.0.1:8787/admin/messages", "x", opener=fake)
        self.assertEqual(page["messages"][0]["message"], "x\x00\n🍵")


if __name__ == "__main__":
    unittest.main()
