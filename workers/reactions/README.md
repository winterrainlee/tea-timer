# Tea Timer Reactions Worker

Cloudflare Worker + D1 backend for the private applause/downvote counter and creator feedback inbox.

## Endpoints

- `POST /reaction`
  - Public browser endpoint used by the applause dialog in `help.html`
  - Body: `{"app":"tea-timer","reaction":"clap"}` or `{"app":"tea-timer","reaction":"down"}`
- `GET /admin/reactions`
  - Private summary endpoint
  - Requires `Authorization: Bearer <ADMIN_TOKEN>`
- `GET /health`
  - Deployment smoke check
- `POST /messages`
  - Creator feedback endpoint. Requires an allowed `Origin`, `FEEDBACK_ENABLED=true`, D1, the rate-limit binding, `FEEDBACK_RATE_SECRET`, and `FEEDBACK_READ_TOKEN`. Origin checks limit browser callers but are not bot authentication.
  - Body: `{"app":"tea-timer","requestId":"UUID","message":"raw text","locale":"ko"|"zh-TW"|"zh-CN"}`
  - The actual request body is limited to 8 KiB; message text is preserved and limited to 1,000 Unicode code points.
  - A matching retry returns its original `{ok:true,id,created_at}` without another insert or rate-limit attempt. `id` is the positive auto-incrementing D1 cursor and `created_at` is UTC ISO 8601. A reused request ID with different text or locale returns `409 conflict`.
- `GET /admin/messages?after=<id>&limit=<1..100>`
  - Requires `Authorization: Bearer <FEEDBACK_READ_TOKEN>`, is deliberately separate from `ADMIN_TOKEN`, has no CORS headers, and uses `Cache-Control: no-store`.
  - Returns only rows newer than 90 days, in ascending ID order. The scheduled Worker handler deletes expired rows daily; it cannot delete provider backups or copies already downloaded by a reader.

## Common Commands

The `db:local` / `db:remote` scripts initialize tables from `schema.sql`; they do not upgrade an existing table's constraints. For an existing feedback database, use the migration runner in **Feedback setup** below. In particular, rerunning `db:remote` does not apply the `zh-CN` constraint migration.

```bash
npm run db:local
npm run db:remote
npm run deploy
npm run test:migration
```

The generated admin token is stored locally in `.env.admin-token`, which is git-ignored.

## Feedback setup

Apply the existing feedback migration and then the locale-constraint migration through Wrangler's migration runner. Do not edit or reapply `0001`: `0002` rebuilds only `messages` and preserves its IDs, timestamps, request IDs, unique constraint, index, and AUTOINCREMENT high-water mark. Wrangler rolls back a failed migration while retaining earlier successful migrations, so the SQL files deliberately omit unsupported `BEGIN`/`COMMIT` statements.

```bash
cd workers/reactions
npx wrangler d1 migrations apply tea-timer-reactions --remote
```

`wrangler.jsonc` binds `FEEDBACK_LIMITER` to the account-defined namespace ID `2026083101`, with a 60-second period and limit 3. Cloudflare namespace IDs are positive integer strings chosen by the account, rather than provisioned resource IDs. Before a first deployment, confirm `2026083101` is unused in the target account; if it is already assigned, choose a different account-unique positive integer consistently in the configuration. The production configuration enables feedback after the migrations, binding, and secrets have been prepared. For a new deployment, keep `FEEDBACK_ENABLED=false` until those prerequisites exist. Set the secrets without putting them in this repository:

```bash
npx wrangler secret put FEEDBACK_RATE_SECRET
npx wrangler secret put FEEDBACK_READ_TOKEN
```

Set `FEEDBACK_ENABLED=true` in the reviewed Worker deployment configuration only after the binding and secrets are live. Keep `ADMIN_TOKEN` unchanged. Update `ALLOWED_ORIGINS` with the deployed app origin(s); local testing can override it with an explicit LAN origin when needed.

Before the enabled deployment, make the reviewed deployment configuration agree with that value: deploying a configuration with `FEEDBACK_ENABLED=false` would disable the inbox again. Do not enable it merely to pass a dry run. The complete release order and data-preserving recovery constraints are recorded in [the TW release checklist](../../docs/tw-implementation-plan.md#release-execution).

For isolated local D1 work, copy `.dev.vars.example` to ignored `.dev.vars`, initialize the local database, and start the Worker. The example values are dummy local credentials. The checked-in rate-limit binding is simulated by Wrangler locally; add an explicit LAN origin to `.dev.vars` only when that local UI is served from a LAN address.

```bash
cp .dev.vars.example .dev.vars
npm run db:local
# Also upgrades an existing local feedback DB; schema.sql alone cannot change its CHECK.
npx wrangler d1 migrations apply tea-timer-reactions --local
npx wrangler dev --local --port 8787
```
