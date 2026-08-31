import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.js";

class MemoryD1 {
  constructor() { this.messages = []; this.reactions = []; this.fail = false; }
  prepare(sql) {
    const db = this; let values = [];
    return {
      bind(...args) { values = args; return this; },
      async first() {
        if (db.fail) throw new Error("D1 unavailable");
        if (sql.includes("WHERE request_id")) return db.messages.find(x => x.request_id === values[0]) || null;
        if (sql.includes("WHERE id = ?")) return db.messages.find(x => x.id === values[0]) || null;
        return null;
      },
      async run() {
        if (db.fail) throw new Error("D1 unavailable");
        if (sql.includes("INSERT INTO messages")) {
          if (db.messages.some(x => x.request_id === values[0])) throw new Error("UNIQUE");
          db.messages.push({ id: db.messages.length + 1, request_id: values[0], message: values[1], locale: values[2], created_at: "2026-08-31T00:00:00.000Z" });
        } else if (sql.includes("INSERT INTO reactions")) db.reactions.push(values[0]);
        else if (sql.includes("DELETE FROM messages")) db.messages = db.messages.filter(x => !x.expired);
        return { success: true, meta: { last_row_id: db.messages.length } };
      },
      async all() {
        if (db.fail) throw new Error("D1 unavailable");
        if (sql.includes("FROM messages")) return { results: db.messages.filter(x => !x.expired && x.id > values[0]).sort((a, b) => a.id - b.id).slice(0, values[1]) };
        return { results: [] };
      },
    };
  }
}
function env(overrides = {}) {
  const DB = new MemoryD1(); let used = 0;
  return { DB, FEEDBACK_ENABLED: "true", FEEDBACK_RATE_SECRET: "test-secret", FEEDBACK_READ_TOKEN: "read", ALLOWED_ORIGINS: "http://localhost:8134", FEEDBACK_LIMITER: { async limit() { used++; return { success: used <= 3 }; } }, ...overrides };
}
function request(body, options = {}) {
  return new Request("https://worker.test/messages", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:8134", "CF-Connecting-IP": "203.0.113.7", ...options.headers }, body: JSON.stringify(body) });
}
const one = "11111111-1111-4111-8111-111111111111";

test("stores raw text and idempotently returns the original row", async () => {
  const e = env(), body = { app: "tea-timer", requestId: one, message: "  원문\\n😀  ", locale: "ko" };
  const first = await worker.fetch(request(body), e), result = await first.json();
  assert.equal(first.status, 200); assert.equal(e.DB.messages.length, 1); assert.equal(e.DB.messages[0].message, body.message);
  const retry = await worker.fetch(request(body), e); assert.deepEqual(await retry.json(), result); assert.equal(e.DB.messages.length, 1);
  const conflict = await worker.fetch(request({ ...body, message: "changed" }), e); assert.equal(conflict.status, 409);
});

test("accepts zh-CN feedback and rejects unsupported locales", async () => {
  const e = env();
  const simplified = { app: "tea-timer", requestId: one, message: "请继续加油", locale: "zh-CN" };
  const first = await worker.fetch(request(simplified), e);
  const result = await first.json();
  assert.equal(first.status, 200);
  assert.equal(e.DB.messages[0].locale, "zh-CN");

  const retry = await worker.fetch(request(simplified), e);
  assert.deepEqual(await retry.json(), result);
  assert.equal(e.DB.messages.length, 1);
  assert.equal((await worker.fetch(request({ ...simplified, locale: "en" }), e)).status, 400);
});

test("simultaneous same-ID writes create exactly one row", async () => {
  const e = env(), body = { app: "tea-timer", requestId: one, message: "once", locale: "ko" };
  const responses = await Promise.all([worker.fetch(request(body), e), worker.fetch(request(body), e)]);
  const results = await Promise.all(responses.map(x => x.json()));
  assert.equal(results[0].ok, true); assert.equal(results[1].ok, true); assert.equal(results[0].id, results[1].id);
  assert.equal(e.DB.messages.length, 1);
});

test("enforces origin, actual size, code points, trusted IP and fail-closed configuration", async () => {
  const body = { app: "tea-timer", requestId: one, message: "x", locale: "ko" };
  assert.equal((await worker.fetch(request(body, { headers: { Origin: "https://evil.test" } }), env())).status, 403);
  assert.equal((await worker.fetch(request({ ...body, message: "😀".repeat(1001) }), env())).status, 400);
  assert.equal((await worker.fetch(request(body, { headers: { "CF-Connecting-IP": "" } }), env())).status, 503);
  assert.equal((await worker.fetch(request(body), env({ FEEDBACK_ENABLED: "false" }))).status, 503);
  const unavailable = env(); unavailable.DB.fail = true;
  assert.equal((await worker.fetch(request(body), unavailable)).status, 503);
  const oversized = new Request("https://worker.test/messages", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:8134", "CF-Connecting-IP": "203.0.113.7" }, body: JSON.stringify({ ...body, padding: "x".repeat(9000) }) });
  assert.equal((await worker.fetch(oversized, env())).status, 413);
});

test("limits writes, preserves reactions, and pages private messages without CORS", async () => {
  const e = env();
  for (let i = 0; i < 3; i++) {
    const id = `11111111-1111-4111-8111-11111111111${i}`;
    assert.equal((await worker.fetch(request({ app: "tea-timer", requestId: id, message: String(i), locale: "ko" }), e)).status, 200);
  }
  assert.equal((await worker.fetch(request({ app: "tea-timer", requestId: "11111111-1111-4111-8111-111111111119", message: "4", locale: "ko" }), e)).status, 429);
  const reaction = await worker.fetch(new Request("https://worker.test/reaction", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"app":"tea-timer","reaction":"clap"}' }), e);
  assert.equal(reaction.status, 200);
  const page = await worker.fetch(new Request("https://worker.test/admin/messages?limit=2", { headers: { Authorization: "Bearer read" } }), e);
  const result = await page.json(); assert.equal(result.messages.length, 2); assert.equal(result.hasMore, true); assert.equal(page.headers.get("Cache-Control"), "no-store"); assert.equal(page.headers.get("Access-Control-Allow-Origin"), null);
  e.DB.messages[0].expired = true;
  let cleanup;
  await worker.scheduled({}, e, { waitUntil(promise) { cleanup = promise; } });
  await cleanup;
  assert.equal(e.DB.messages.length, 2);
});

test("private reader rejects anonymous and applause tokens, with no CORS even on preflight", async () => {
  const e = env({ ADMIN_TOKEN: "applause-only" });
  for (const headers of [{}, { Authorization: "Bearer applause-only" }]) {
    const response = await worker.fetch(new Request("https://worker.test/admin/messages", { headers }), e);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  const preflight = await worker.fetch(new Request("https://worker.test/admin/messages", { method: "OPTIONS", headers: { Origin: "http://localhost:8134" } }), e);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), null);
  const body = { app: "tea-timer", requestId: one, message: "x", locale: "ko" };
  for (const missing of ["FEEDBACK_READ_TOKEN", "FEEDBACK_RATE_SECRET", "FEEDBACK_LIMITER", "DB"])
    assert.equal((await worker.fetch(request(body), env({ [missing]: undefined }))).status, 503);
});

test("cursor walks ID gaps and new arrivals", async () => {
  const e = env();
  e.DB.messages = [1, 3, 5].map(id => ({ id, request_id: `private-${id}`, message: String(id), locale: "ko", created_at: "2026-08-31T00:00:00Z" }));
  const read = async after => (await worker.fetch(new Request(`https://worker.test/admin/messages?after=${after}&limit=2`, { headers: { Authorization: "Bearer read" } }), e)).json();
  const first = await read(0);
  assert.deepEqual(first.messages.map(m => m.id), [1, 3]); assert.equal(first.nextCursor, 3); assert.equal(first.hasMore, true);
  const last = await read(first.nextCursor);
  assert.deepEqual(last.messages.map(m => m.id), [5]); assert.equal(last.nextCursor, 5); assert.equal(last.hasMore, false);
  e.DB.messages.push({ id: 6, message: "new", locale: "zh-TW", created_at: "2026-08-31T00:00:00Z" });
  assert.deepEqual((await read(last.nextCursor)).messages.map(m => m.id), [6]);
  assert.deepEqual(await read(6), { ok: true, messages: [], nextCursor: null, hasMore: false });
});
