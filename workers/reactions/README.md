# Tea Timer Reactions Worker

Cloudflare Worker + D1 backend for the private applause/downvote counter.

## Endpoints

- `POST /reaction`
  - Public browser endpoint used by `index.html`
  - Body: `{"app":"tea-timer","reaction":"clap"}` or `{"app":"tea-timer","reaction":"down"}`
- `GET /admin/reactions`
  - Private summary endpoint
  - Requires `Authorization: Bearer <ADMIN_TOKEN>`
- `GET /health`
  - Deployment smoke check

## Common Commands

```bash
npm run db:local
npm run db:remote
npm run deploy
```

The generated admin token is stored locally in `.env.admin-token`, which is git-ignored.
