# Deploying NoteMind

NoteMind is **two independently deployed pieces** with no shared build:

| Piece | What it is | Host |
|---|---|---|
| `client/` | Vite static build (SPA) | Vercel |
| `server/` | Express + Socket.IO API | Render (Docker) |

**Why two platforms rather than one.** The client is just files, which Vercel
serves perfectly. The API is a long-running process holding open Socket.IO
connections. Vercel is serverless — it does support WebSockets now, but a
connection is pinned to whichever function instance accepted it and there is
**no cross-instance broadcasting**. This app's `broadcastAdminUpdate` and
`pushNotificationToUser` emit to rooms spanning all connections, so an admin
socket on instance A would never receive an event emitted from instance B: the
Live badge would show green while nothing actually updated. Keeping the API on
a normal always-on process avoids that entirely. Neither platform requires a
card on the free tier.

The single most common way to break a deploy is a mismatch between the two
origins. `CLIENT_URL` on the server must list the exact origin the browser
loads the client from, and `VITE_API_URL` on the client must point at the
server's `/api` path. Neither has a working default in production — the server
refuses to boot without `CLIENT_URL`, and the client build fails without
`VITE_API_URL`, both deliberately.

---

## 1. MongoDB Atlas (free M0)

1. Create a free M0 cluster.
2. Database Access → add a user with **Read and write to any database**.
3. Network Access → allow `0.0.0.0/0` (Render does not publish fixed egress IPs
   on the free tier).
4. Copy the connection string → this is `MONGO_URI`.

Atlas M0 has **no automated backups**. Until you move to a paid tier, take
periodic dumps yourself (`mongodump`) — there is no undo for a bad migration.

## 2. Cloudflare R2 (free tier: 10 GB, zero egress)

1. Cloudflare dashboard → R2 → **Create bucket** (e.g. `notemind-uploads`).
2. R2 → **Manage API tokens** → create a token with **Object Read & Write**
   scoped to that bucket.
3. Note the Account ID, Access Key ID and Secret Access Key.

R2 is **mandatory in production** — `config/env.js` refuses to boot without it.
That is on purpose: local-disk uploads are wiped on every deploy, restart and
scale event, which silently turns every image any user has ever pasted into a
broken `<img>` with no recovery path.

If you already have images in `server/uploads/`, migrate them before cutover:

```bash
cd server
node scripts/migrate-uploads-to-r2.js --dry   # preview
node scripts/migrate-uploads-to-r2.js         # copy
```

Notes store the relative `/uploads/<file>` path, so nothing in the database
needs rewriting. Local files are left in place — delete them only after you've
confirmed images render from R2.

## 3. API on Render

1. New → **Web Service** → connect the repo.
2. Root directory `server`, runtime **Docker** (uses `server/Dockerfile`).
3. Health check path: `/healthz`.
4. Environment variables:

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` |
| `MONGO_URI` | from step 1 |
| `JWT_SECRET` | **≥32 chars in production.** `openssl rand -base64 48`. Changing it logs every user out. |
| `CLIENT_URL` | the Pages origin, e.g. `https://notemind.pages.dev`. Comma-separate for multiple. |
| `GEMINI_API_KEYS` | comma-separated. AI degrades gracefully if absent; the app still runs. |
| `GOOGLE_CLIENT_ID` | optional; must match `VITE_GOOGLE_CLIENT_ID` exactly |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` | from step 2 — all four or none |
| `DAILY_AI_CALL_LIMIT` | optional, default `200` per user per UTC day |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Gmail backend — no domain needed. Both or neither. |
| `RESEND_API_KEY` / `EMAIL_FROM` | Resend backend — needs a verified domain. Wins if both backends set. |
| `SENTRY_DSN` | optional |
| `LOG_LEVEL` | optional, default `info` |

**No credit card is required** for Render's free tier.

**It does spin down after 15 minutes idle**, so the first request after a quiet
period takes ~50 s while the container starts. To avoid that, ping `/healthz`
every 14 minutes from any free scheduler — cron-job.org, UptimeRobot, or a
GitHub Actions schedule:

```yaml
# .github/workflows/keep-warm.yml
name: Keep API warm
on:
  schedule:
    - cron: '*/14 * * * *'
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS https://<your-render-service>.onrender.com/healthz
```

`/healthz` is excluded from request logging, so this won't drown your logs.

## 4. Client on Vercel

1. Vercel → **Add New** → Project → import the repo.
2. Set **Root Directory** to `client`. Everything else (framework, build
   command, output directory) is already declared in `client/vercel.json`.
3. Environment variables:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://<your-render-service>.onrender.com/api` — note the `/api` suffix |
| `VITE_GOOGLE_CLIENT_ID` | optional; same Client ID as the server's |

`VITE_API_URL` is read at **build** time, so after changing it you must
redeploy — editing the variable alone changes nothing in the shipped bundle.
The build fails outright if it's missing, deliberately (see
`client/vite.config.js`).

Routing rules and security headers live in `client/vercel.json`. Read
`client/VERCEL_NOTES.md` before editing it — the SPA rewrite has to exclude
`sw.js`, and `sw.js` has to stay uncached, or deploys stop reaching users.

## 5. Email — pick one backend

Only password-reset mail is sent today. With neither backend configured the
flow still works end to end, but the link is written to the server log rather
than emailed — developable without credentials, useless to a real user.

**Gmail (no domain needed).** Sends through a normal Gmail account, ~500/day.

1. On that Google account: **Security** → turn on **2-Step Verification**
   (App passwords don't exist without it).
2. **Security** → **App passwords** → create one → copy the 16 characters.
3. Set `GMAIL_USER` (full address) and `GMAIL_APP_PASSWORD`. The spaces Google
   displays are stripped automatically.

This is **not** your Google account password — it's a separate credential that
only grants SMTP, and can be revoked on its own.

**Resend (needs a domain).** Better deliverability and a real from-address;
takes precedence if both are configured.

1. resend.com → create an API key.
2. Add and verify your sending domain by DNS. You cannot verify `gmail.com` —
   without a domain Resend only delivers to your own signup address.
3. Set `RESEND_API_KEY` and `EMAIL_FROM`.

Either way, a half-configured backend refuses to boot rather than silently
falling back to logging.

## 6. Google Sign-In (optional)

Both `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` must be set to the **same**
OAuth client ID (Google Cloud Console → Credentials → OAuth client ID → Web
application), with the Pages origin listed as an authorised JavaScript origin.
If either is missing the button does not render and the endpoint returns 501.

> Google linking from an existing account is done in Account > Sign-in methods.
> `POST /auth/google` deliberately refuses to auto-link a Google identity to an
> existing account that merely shares its email address (that was an account
> pre-hijacking hole); users link from Account settings instead, which proves
> ownership.

---

## Verifying a deploy

```bash
curl https://<api-host>/healthz          # {"status":"ok","db":"connected",...}
```

Then in the browser: sign in, create a note, paste an image, reload, and
confirm the image still renders (that exercises R2 and the signed-URL path).
Refresh directly on `/dashboard` — a 404 means the SPA rewrite in
`vercel.json` is wrong. Check the Admin page shows **Live**; if it shows
**Offline**, `CLIENT_URL` does not match your Vercel origin.

## Order of operations

Deploy the API to Render first and note its URL. Then deploy the client to
Vercel with `VITE_API_URL` pointing at it. Finally set `CLIENT_URL` on Render
to your Vercel origin and redeploy the API — it needs to know the client's
origin for CORS and the Socket.IO handshake, and that origin doesn't exist
until the first Vercel deploy. Each service needs one redeploy after the
other's URL is known; this is expected, not a mistake.

## Known gaps at launch

- **Password reset needs email credentials to actually send.** The flow works
  end to end without them, but the message is written to the log instead of
  delivered — so set `RESEND_API_KEY` and `EMAIL_FROM` before real users
  arrive, or nobody can recover a forgotten password on their own.
- **Admins cannot see images inside another user's note.** Admin moderation
  shows note text, but `sign-images` only signs files the caller owns, so
  images render as placeholders. Deliberate — minting URLs for another user's
  private files is a bigger call than the moderation feature needed.
- **Indexes are not built at boot in production** (`autoIndex: false`). After a
  schema change, sync them deliberately rather than relying on a restart.
