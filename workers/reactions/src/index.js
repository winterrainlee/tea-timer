const DEFAULT_ORIGIN = "https://winterrainlee.github.io";
const VALID_REACTIONS = new Set(["clap", "down"]);
const VALID_LOCALES = new Set(["ko", "zh-TW", "zh-CN"]);
const MAX_BYTES = 8 * 1024;
const RETENTION_DAYS = 90;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || DEFAULT_ORIGIN).split(",").map(x => x.trim()).filter(Boolean);
}
function responseOrigin(request, env) {
  const origin = request.headers.get("Origin");
  return origin && allowedOrigins(env).includes(origin) ? origin : (allowedOrigins(env)[0] || DEFAULT_ORIGIN);
}
function corsHeaders(request, env) {
  return { "Access-Control-Allow-Origin": responseOrigin(request, env), "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Vary": "Origin" };
}
function json(request, env, data, init = {}) {
  return new Response(JSON.stringify(data), { ...init, headers: { "Content-Type": "application/json", ...corsHeaders(request, env), ...(init.headers || {}) } });
}
function feedbackAllowed(request, env) {
  const origin = request.headers.get("Origin");
  return Boolean(origin && allowedOrigins(env).includes(origin));
}
function feedbackCors(request, env) {
  return feedbackAllowed(request, env) ? { "Access-Control-Allow-Origin": request.headers.get("Origin"), "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" } : {};
}
function feedbackJson(request, env, data, init = {}) {
  return new Response(JSON.stringify(data), { ...init, headers: { "Content-Type": "application/json", ...feedbackCors(request, env), ...(init.headers || {}) } });
}
function privateJson(data, init = {}) {
  return new Response(JSON.stringify(data), { ...init, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...(init.headers || {}) } });
}

async function readReaction(request) {
  if (Number(request.headers.get("Content-Length") || 0) > 1024) return null;
  const body = await request.json().catch(() => null);
  return body && body.app === "tea-timer" && VALID_REACTIONS.has(body.reaction) ? body.reaction : null;
}
async function readFeedback(request) {
  if (Number(request.headers.get("Content-Length") || 0) > MAX_BYTES) return { error: "payload_too_large" };
  if (!request.body) return { error: "invalid_request" };
  const reader = request.body.getReader(), chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); return { error: "payload_too_large" }; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let at = 0;
    for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength; }
    const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body) || body.app !== "tea-timer" || typeof body.requestId !== "string" || !UUID.test(body.requestId) || typeof body.message !== "string" || !VALID_LOCALES.has(body.locale)) return { error: "invalid_request" };
    if (!body.message.trim()) return { error: "empty_message" };
    if (Array.from(body.message).length > 1000) return { error: "message_too_long" };
    return { value: { requestId: body.requestId, message: body.message, locale: body.locale } };
  } catch { return { error: "invalid_request" }; }
}
function feedbackConfigured(env) { return env.FEEDBACK_ENABLED === "true" && env.DB && env.FEEDBACK_READ_TOKEN && env.FEEDBACK_RATE_SECRET && env.FEEDBACK_LIMITER && typeof env.FEEDBACK_LIMITER.limit === "function"; }
function readerConfigured(env) { return env.DB && env.FEEDBACK_READ_TOKEN; }
function isAdmin(request, env) { return Boolean(env.ADMIN_TOKEN && request.headers.get("Authorization") === `Bearer ${env.ADMIN_TOKEN}`); }
function isReader(request, env) { return Boolean(env.FEEDBACK_READ_TOKEN && request.headers.get("Authorization") === `Bearer ${env.FEEDBACK_READ_TOKEN}`); }
async function feedbackKey(request, secret) {
  const ip = request.headers.get("CF-Connecting-IP"); if (!ip) return null;
  const date = new Date().toISOString().slice(0, 10);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${date}:${ip}`));
  return `tea-timer-feedback:${date}:${Array.from(new Uint8Array(sig), x => x.toString(16).padStart(2, "0")).join("")}`;
}
async function existing(db, requestId) {
  return db.prepare(`SELECT id, message, locale, created_at FROM messages WHERE request_id = ? AND julianday(created_at) >= julianday('now', '-${RETENTION_DAYS} days')`).bind(requestId).first();
}
function matches(row, value) { return row && row.message === value.message && row.locale === value.locale; }

async function handleReaction(request, env) {
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigins(env).includes(origin)) return json(request, env, { ok: false, error: "origin_not_allowed" }, { status: 403 });
  const reaction = await readReaction(request); if (!reaction) return json(request, env, { ok: false, error: "invalid_reaction" }, { status: 400 });
  await env.DB.prepare("INSERT INTO reactions (app, reaction) VALUES ('tea-timer', ?)").bind(reaction).run();
  return json(request, env, { ok: true });
}
async function handleAdmin(request, env) {
  if (!isAdmin(request, env)) return json(request, env, { ok: false, error: "unauthorized" }, { status: 401 });
  const totals = await env.DB.prepare("SELECT reaction, COUNT(*) AS count FROM reactions WHERE app = 'tea-timer' GROUP BY reaction ORDER BY reaction").all();
  const daily = await env.DB.prepare("SELECT substr(created_at, 1, 10) AS day, reaction, COUNT(*) AS count FROM reactions WHERE app = 'tea-timer' GROUP BY day, reaction ORDER BY day DESC, reaction LIMIT 90").all();
  return json(request, env, { ok: true, totals: totals.results, daily: daily.results });
}
async function handleFeedback(request, env) {
  if (!feedbackConfigured(env)) return feedbackJson(request, env, { ok: false, error: "unavailable" }, { status: 503 });
  if (!feedbackAllowed(request, env)) return feedbackJson(request, env, { ok: false, error: "invalid_origin" }, { status: 403 });
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("Content-Type") || "")) return feedbackJson(request, env, { ok: false, error: "invalid_request" }, { status: 400 });
  const parsed = await readFeedback(request); if (parsed.error) return feedbackJson(request, env, { ok: false, error: parsed.error }, { status: parsed.error === "payload_too_large" ? 413 : 400 });
  const value = parsed.value;
  try {
    let row = await existing(env.DB, value.requestId);
    if (row) return matches(row, value) ? feedbackJson(request, env, { ok: true, id: row.id, created_at: row.created_at }) : feedbackJson(request, env, { ok: false, error: "conflict" }, { status: 409 });
    const key = await feedbackKey(request, env.FEEDBACK_RATE_SECRET); if (!key) return feedbackJson(request, env, { ok: false, error: "unavailable" }, { status: 503 });
    let rate; try { rate = await env.FEEDBACK_LIMITER.limit({ key }); } catch { return feedbackJson(request, env, { ok: false, error: "unavailable" }, { status: 503 }); }
    if (!rate || !rate.success) return feedbackJson(request, env, { ok: false, error: "rate_limited" }, { status: 429 });
    const inserted = await env.DB.prepare("INSERT INTO messages (request_id, message, locale) VALUES (?, ?, ?)").bind(value.requestId, value.message, value.locale).run();
    row = await env.DB.prepare("SELECT id, created_at FROM messages WHERE id = ?").bind(inserted.meta.last_row_id).first();
    return feedbackJson(request, env, { ok: true, id: row.id, created_at: row.created_at });
  } catch {
    try { const row = await existing(env.DB, value.requestId); if (row) return matches(row, value) ? feedbackJson(request, env, { ok: true, id: row.id, created_at: row.created_at }) : feedbackJson(request, env, { ok: false, error: "conflict" }, { status: 409 }); } catch {}
    return feedbackJson(request, env, { ok: false, error: "unavailable" }, { status: 503 });
  }
}
async function handleFeedbackAdmin(request, env, url) {
  if (!readerConfigured(env)) return privateJson({ ok: false, error: "unavailable" }, { status: 503 });
  if (!isReader(request, env)) return privateJson({ ok: false, error: "unauthorized" }, { status: 401 });
  const after = url.searchParams.get("after") || "", limitText = url.searchParams.get("limit") || "50";
  if ((after && !/^[0-9]+$/.test(after)) || !/^[1-9][0-9]{0,2}$/.test(limitText) || Number(limitText) > 100) return privateJson({ ok: false, error: "invalid_request" }, { status: 400 });
  try {
    const limit = Number(limitText), rows = await env.DB.prepare(`SELECT id, message, locale, created_at FROM messages WHERE julianday(created_at) >= julianday('now', '-${RETENTION_DAYS} days') AND id > ? ORDER BY id ASC LIMIT ?`).bind(Number(after), limit + 1).all();
    const hasMore = rows.results.length > limit, messages = hasMore ? rows.results.slice(0, limit) : rows.results;
    return privateJson({ ok: true, messages, nextCursor: messages.length ? messages.at(-1).id : null, hasMore });
  } catch { return privateJson({ ok: false, error: "unavailable" }, { status: 503 }); }
}
async function cleanExpiredMessages(env) { if (env.DB) await env.DB.prepare(`DELETE FROM messages WHERE julianday(created_at) < julianday('now', '-${RETENTION_DAYS} days')`).run(); }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/messages" && request.method === "OPTIONS") return feedbackAllowed(request, env) ? new Response(null, { status: 204, headers: feedbackCors(request, env) }) : feedbackJson(request, env, { ok: false, error: "invalid_origin" }, { status: 403 });
    if (url.pathname === "/admin/messages" && request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    if (url.pathname === "/reaction" && request.method === "POST") return handleReaction(request, env);
    if (url.pathname === "/admin/reactions" && request.method === "GET") return handleAdmin(request, env);
    if (url.pathname === "/messages" && request.method === "POST") return handleFeedback(request, env);
    if (url.pathname === "/admin/messages" && request.method === "GET") return handleFeedbackAdmin(request, env, url);
    if (url.pathname === "/health" && request.method === "GET") return json(request, env, { ok: true });
    return json(request, env, { ok: false, error: "not_found" }, { status: 404 });
  },
  async scheduled(_event, env, ctx) { ctx.waitUntil(cleanExpiredMessages(env)); },
};
