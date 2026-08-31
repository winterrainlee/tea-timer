#!/usr/bin/env python3
"""Read and locally sync creator feedback without exposing the read token."""

from __future__ import annotations

import argparse
from contextlib import contextmanager
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import sys
import tempfile
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

DEFAULT_ENDPOINT = "https://tea-timer-reactions.winterrain-lee.workers.dev/admin/messages"
TOKEN_FILE = Path("workers/reactions/.env.feedback-read-token")
STATE_NAME = "state.json"
MAX_PAGE = 100
MAX_RESPONSE_BYTES = 1024 * 1024
RETENTION_DAYS = 90
LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}


class _RejectRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise FeedbackError("feedback request failed")


_SAFE_OPENER = build_opener(_RejectRedirect()).open


class FeedbackError(Exception):
    pass


def endpoint_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.query or parsed.fragment or parsed.username is not None or parsed.password is not None:
        raise FeedbackError("endpoint must not contain query parameters or fragments")
    if parsed.scheme == "https" and parsed.netloc == "tea-timer-reactions.winterrain-lee.workers.dev" and parsed.path == "/admin/messages":
        return value
    if parsed.scheme == "http" and parsed.hostname in LOOPBACK_HOSTS and parsed.path == "/admin/messages":
        return value
    raise FeedbackError("endpoint must be the configured worker URL or an HTTP loopback /admin/messages URL")


def token_from_env_or_file(root: Path) -> str:
    token = os.environ.get("FEEDBACK_READ_TOKEN", "").strip()
    if token:
        return token
    path = root / TOKEN_FILE
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        raise FeedbackError("FEEDBACK_READ_TOKEN is not configured")
    for line in text.splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            if line.startswith("FEEDBACK_READ_TOKEN="):
                line = line.split("=", 1)[1].strip().strip("'\"")
            if line:
                return line
    raise FeedbackError("FEEDBACK_READ_TOKEN is not configured")


def _safe_error(exc: Exception) -> FeedbackError:
    if isinstance(exc, HTTPError):
        return FeedbackError(f"feedback request failed with HTTP {exc.code}")
    if isinstance(exc, URLError):
        return FeedbackError("feedback request failed")
    if isinstance(exc, (json.JSONDecodeError, UnicodeDecodeError)):
        return FeedbackError("feedback response was invalid")
    if isinstance(exc, FeedbackError):
        return exc
    return FeedbackError("feedback request failed")


def fetch_page(endpoint: str, token: str, after: int | None = None, limit: int = 50, opener=_SAFE_OPENER) -> dict[str, Any]:
    endpoint = endpoint_url(endpoint)
    if not 1 <= limit <= MAX_PAGE:
        raise FeedbackError("limit must be between 1 and 100")
    parsed = urlparse(endpoint)
    query = parse_qs(parsed.query, keep_blank_values=True)
    query["limit"] = [str(limit)]
    if after is not None:
        query["after"] = [str(after)]
    else:
        query.pop("after", None)
    url = urlunparse(parsed._replace(query=urlencode(query, doseq=True)))
    # Identify this API client explicitly; Cloudflare rejects urllib's generic UA.
    request = Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/json", "Cache-Control": "no-store", "User-Agent": "TeaTimerFeedbackReader/1.0"})
    try:
        with opener(request, timeout=20) as response:
            raw = response.read(MAX_RESPONSE_BYTES + 1)
            if len(raw) > MAX_RESPONSE_BYTES:
                raise FeedbackError("feedback response was too large")
            payload = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise _safe_error(exc) from None
    if not isinstance(payload, dict) or payload.get("ok") is not True or not isinstance(payload.get("messages"), list):
        raise FeedbackError("feedback response was invalid")
    messages = []
    previous = after
    for item in payload["messages"]:
        item_id = item.get("id") if isinstance(item, dict) else None
        if not isinstance(item_id, int) or isinstance(item_id, bool) or item_id <= 0 or (previous is not None and item_id <= previous) or not isinstance(item, dict) or not isinstance(item.get("message"), str) or not isinstance(item.get("locale"), str) or not isinstance(item.get("created_at"), str) or parse_created(item.get("created_at")) is None:
            raise FeedbackError("feedback response was invalid")
        messages.append({"id": item_id, "message": item["message"], "locale": item["locale"], "created_at": item["created_at"]})
        previous = item_id
    next_cursor = payload.get("nextCursor")
    if next_cursor is not None and (not isinstance(next_cursor, int) or isinstance(next_cursor, bool) or next_cursor <= 0):
        raise FeedbackError("feedback response was invalid")
    if not isinstance(payload.get("hasMore"), bool) or len(messages) > limit:
        raise FeedbackError("feedback response was invalid")
    has_more = payload["hasMore"]
    if not messages and next_cursor is not None:
        raise FeedbackError("feedback response was invalid")
    if has_more and (next_cursor is None or not messages):
        raise FeedbackError("feedback response was invalid")
    if messages and next_cursor != messages[-1]["id"]:
        raise FeedbackError("feedback response was invalid")
    if has_more and after is not None and next_cursor <= after:
        raise FeedbackError("feedback response was invalid")
    return {"messages": messages, "nextCursor": next_cursor, "hasMore": has_more}


def state_path(root: Path) -> Path:
    return root / ".local" / "feedback" / STATE_NAME


def empty_state() -> dict[str, Any]:
    return {"cursor": None, "messages": [], "acknowledged": []}


def load_state(root: Path) -> dict[str, Any]:
    path = state_path(root)
    if not path.exists():
        return empty_state()
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(value, dict) or (value.get("cursor") is not None and (not isinstance(value["cursor"], int) or isinstance(value["cursor"], bool) or value["cursor"] <= 0)) or not isinstance(value.get("messages"), list) or not isinstance(value.get("acknowledged"), list):
            raise ValueError
        for item in value["messages"]:
            if not isinstance(item, dict) or not isinstance(item.get("id"), int) or isinstance(item.get("id"), bool) or item["id"] <= 0 or not isinstance(item.get("message"), str) or not isinstance(item.get("locale"), str) or not isinstance(item.get("created_at"), str) or parse_created(item["created_at"]) is None:
                raise ValueError
        if any(not isinstance(i, int) or isinstance(i, bool) or i <= 0 for i in value["acknowledged"]):
            raise ValueError
        return value
    except (OSError, ValueError, json.JSONDecodeError, UnicodeDecodeError):
        raise FeedbackError("local feedback state is corrupt; no changes made")


def save_state(root: Path, state: dict[str, Any]) -> None:
    directory = state_path(root).parent
    directory.mkdir(parents=True, exist_ok=True)
    os.chmod(directory, 0o700)
    fd, tmp = tempfile.mkstemp(prefix=".state.", dir=directory)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(state, stream, ensure_ascii=False, separators=(",", ":"))
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(tmp, state_path(root))
        os.chmod(state_path(root), 0o600)
    finally:
        try:
            os.unlink(tmp)
        except FileNotFoundError:
            pass


def cutoff() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=RETENTION_DAYS)


def parse_created(value: str) -> dt.datetime | None:
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo is not None and parsed.utcoffset() is not None else None
    except ValueError:
        return None


def retain(state: dict[str, Any]) -> None:
    limit = cutoff()
    state["messages"] = [m for m in state["messages"] if (parse_created(m["created_at"]) is None or parse_created(m["created_at"]) >= limit)]
    ids = {m["id"] for m in state["messages"]}
    state["acknowledged"] = sorted(i for i in state["acknowledged"] if i in ids)


@contextmanager
def state_lock(root: Path):
    directory = state_path(root).parent
    directory.mkdir(parents=True, exist_ok=True)
    os.chmod(directory, 0o700)
    lock_path = directory / ".lock"
    with open(lock_path, "a+", encoding="utf-8") as lock:
        os.chmod(lock_path, 0o600)
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock.fileno(), fcntl.LOCK_UN)


def sync(root: Path, endpoint: str, token: str, limit: int, opener=_SAFE_OPENER) -> dict[str, Any]:
    with state_lock(root):
        state = load_state(root)
        retain(state)
        # Persist local retention before any network work; a failed fetch must not
        # leave expired copies behind, and a failed write must prevent a fetch.
        save_state(root, state)
        saved = 0
        while True:
            page = fetch_page(endpoint, token, state["cursor"], limit, opener=opener)
            by_id = {m["id"]: m for m in state["messages"]}
            for message in page["messages"]:
                by_id[message["id"]] = message
            state["messages"] = sorted(by_id.values(), key=lambda m: m["id"])
            saved += len(page["messages"])
            # Persist the batch before advancing the cursor. A failed write leaves the old cursor.
            if page["messages"]:
                state["cursor"] = page["messages"][-1]["id"]
            save_state(root, state)
            if not page["hasMore"] or not page["messages"]:
                break
        retain(state)
        save_state(root, state)
        return {"saved": saved, "cursor": state["cursor"], "pending": len([m for m in state["messages"] if m["id"] not in state["acknowledged"]])}


def json_output(value: Any) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Read or sync private creator feedback")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2], help="repository root for private state and token file")
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT)
    parser.add_argument("--limit", type=int, default=50)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("fetch", help="fetch one page")
    sub.add_parser("sync", help="fetch pages into local private state")
    sub.add_parser("pending", help="show unacknowledged local messages")
    ack = sub.add_parser("ack", help="acknowledge local message IDs")
    ack.add_argument("ids", nargs="+", type=int)
    args = parser.parse_args(argv)
    try:
        endpoint = endpoint_url(args.endpoint)
        if args.command == "pending":
            with state_lock(args.root):
                state = load_state(args.root)
                retain(state)
                save_state(args.root, state)
                json_output([m for m in state["messages"] if m["id"] not in state["acknowledged"]])
        elif args.command == "ack":
            with state_lock(args.root):
                state = load_state(args.root)
                known = {m["id"] for m in state["messages"]}
                applied = sorted({i for i in args.ids} & known)
                state["acknowledged"] = sorted(set(state["acknowledged"]) | set(applied))
                save_state(args.root, state)
                json_output({"acknowledged": applied})
        else:
            token = token_from_env_or_file(args.root)
            if args.command == "fetch":
                json_output(fetch_page(endpoint, token, None, args.limit))
            else:
                json_output(sync(args.root, endpoint, token, args.limit))
        return 0
    except OSError:
        print("local feedback storage failed; check file access and free space", file=sys.stderr)
        return 1
    except FeedbackError as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
