const DEFAULT_ORIGIN = "https://winterrainlee.github.io";
const VALID_REACTIONS = new Set(["clap", "down"]);

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || DEFAULT_ORIGIN)
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);
}

function responseOrigin(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = allowedOrigins(env);
  if (origin && allowed.includes(origin)) return origin;
  return allowed[0] || DEFAULT_ORIGIN;
}

function corsHeaders(request, env) {
  return {
    "Access-Control-Allow-Origin": responseOrigin(request, env),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Vary": "Origin",
  };
}

function json(request, env, data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(request, env),
      ...(init.headers || {}),
    },
  });
}

async function readReaction(request) {
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > 1024) return null;

  const body = await request.json().catch(() => null);
  if (!body || body.app !== "tea-timer") return null;
  if (!VALID_REACTIONS.has(body.reaction)) return null;

  return body.reaction;
}

function isAllowedBrowserOrigin(request, env) {
  const origin = request.headers.get("Origin");
  return !origin || allowedOrigins(env).includes(origin);
}

function isAdmin(request, env) {
  const expected = env.ADMIN_TOKEN;
  const actual = request.headers.get("Authorization");
  return Boolean(expected && actual === `Bearer ${expected}`);
}

async function handleReaction(request, env) {
  if (!isAllowedBrowserOrigin(request, env)) {
    return json(request, env, { ok: false, error: "origin_not_allowed" }, { status: 403 });
  }

  const reaction = await readReaction(request);
  if (!reaction) {
    return json(request, env, { ok: false, error: "invalid_reaction" }, { status: 400 });
  }

  await env.DB.prepare(
    "INSERT INTO reactions (app, reaction) VALUES ('tea-timer', ?)"
  ).bind(reaction).run();

  return json(request, env, { ok: true });
}

async function handleAdmin(request, env) {
  if (!isAdmin(request, env)) {
    return json(request, env, { ok: false, error: "unauthorized" }, { status: 401 });
  }

  const totals = await env.DB.prepare(`
    SELECT reaction, COUNT(*) AS count
    FROM reactions
    WHERE app = 'tea-timer'
    GROUP BY reaction
    ORDER BY reaction
  `).all();

  const daily = await env.DB.prepare(`
    SELECT substr(created_at, 1, 10) AS day, reaction, COUNT(*) AS count
    FROM reactions
    WHERE app = 'tea-timer'
    GROUP BY day, reaction
    ORDER BY day DESC, reaction
    LIMIT 90
  `).all();

  return json(request, env, {
    ok: true,
    totals: totals.results,
    daily: daily.results,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (url.pathname === "/reaction" && request.method === "POST") {
      return handleReaction(request, env);
    }

    if (url.pathname === "/admin/reactions" && request.method === "GET") {
      return handleAdmin(request, env);
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return json(request, env, { ok: true });
    }

    return json(request, env, { ok: false, error: "not_found" }, { status: 404 });
  },
};
