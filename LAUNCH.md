# Launch checklist

Ordered list of the things a human has to do. Everything here needs an account,
a browser, or a secret — none of it can be done from the codebase.

`DEPLOY.md` is the reference doc (what each variable means, how the pieces fit).
This is the do-list. Work top to bottom; later steps depend on earlier ones.

Total time: roughly an hour, most of it waiting for deploys.

---

## 0. ~~Generate a new JWT_SECRET~~  ·  DONE

Already done — a fresh 64-character secret is in `server/.env`. Production
requires 32+ and the server refuses to boot below that, since this one value
protects every session in the app.

You'll need to copy it into Render at step 5:

```bash
grep '^JWT_SECRET=' server/.env
```

---

## 1. MongoDB Atlas — the database  ·  10 min

1. Sign up at [mongodb.com/atlas](https://www.mongodb.com/atlas) → **Create** →
   **M0 Free**.
2. **Database Access** → Add New Database User → username + password →
   **Read and write to any database**.
3. **Network Access** → Add IP Address → **Allow access from anywhere**
   (`0.0.0.0/0`). Render's free tier has no fixed outbound IP, so a narrower
   rule will just block your own API.
4. **Connect** → **Drivers** → copy the connection string. It looks like
   `mongodb+srv://user:PASSWORD@cluster.xxxxx.mongodb.net/notemind`
   — replace `PASSWORD` with the one from step 2, and make sure a database
   name (`/notemind`) is on the end.

Save it. This is `MONGO_URI`.

> M0 has **no automated backups**. Take a `mongodump` before anything risky.

---

## 2. Cloudflare R2 — image storage  ·  10 min

Required in production. The server refuses to boot without it, because
local-disk uploads are wiped on every deploy — every image every user ever
pasted would turn into a broken box with no way to recover it.

1. Sign up at [cloudflare.com](https://dash.cloudflare.com) → **R2** →
   **Create bucket** → name it `notemind-uploads`.
   (R2 asks for a card to *enable* it, but the free tier — 10 GB, zero egress —
   is not charged.)
2. **R2** → **Manage API tokens** → **Create API token** → permission
   **Object Read & Write**, scoped to that bucket.
3. Copy all four values:
   - Account ID (top right of the R2 page)
   - Access Key ID
   - Secret Access Key
   - Bucket name

Save them. These are `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

---

## 3. Gmail App Password — password reset emails  ·  5 min

Without this, a user who forgets their password is locked out permanently and
you have to reset it for them by hand.

Using the `notemind.ai.app@gmail.com` account, since no domain is needed:

1. Go to [myaccount.google.com/security](https://myaccount.google.com/security)
   while signed in as that account.
2. Turn on **2-Step Verification** if it isn't already. App passwords do not
   exist without it — there's no way around this step.
3. Search settings for **App passwords** (or go to
   [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)).
4. Create one, name it `NoteMind`, copy the 16 characters.

Save two values:

| Variable | Value |
|---|---|
| `GMAIL_USER` | `notemind.ai.app@gmail.com` |
| `GMAIL_APP_PASSWORD` | the 16 characters (spaces are fine, they're stripped) |

> This is **not** your Google password. It's a separate credential that only
> permits sending mail, and you can revoke it alone without touching the
> account.

Limits: ~500 emails/day, and mail arrives from the Gmail address. Both fine to
start. Once you own a domain, switch to Resend (`RESEND_API_KEY` +
`EMAIL_FROM`) for better deliverability — the code already supports it and
prefers it automatically when configured.

---

## 4. ~~Push the code to GitHub~~  ·  DONE

Already pushed to `github.com/Ahmadhsn1/notemind-app` on `main`. Verified that
no `.env`, `CLAUDE.md` or `.claude` reached the remote.

One piece is missing: `.github/workflows/ci.yml` couldn't be pushed because the
GitHub token lacks the `workflow` scope. CI is optional and nothing else
depends on it. To add it:

```bash
gh auth refresh -s workflow
git add .github && git commit -m "Add CI workflow" && git push
```

---

## 5. Deploy the API to Render  ·  15 min

No credit card required.

1. [render.com](https://render.com) → sign up with GitHub.
2. **New** → **Web Service** → pick the `notemind-app` repo.
3. Settings:
   - **Root Directory**: `server`
   - **Runtime**: Docker
   - **Instance Type**: Free
   - **Health Check Path**: `/healthz`
4. **Environment** → add these:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGO_URI` | from step 1 |
   | `JWT_SECRET` | from step 0 |
   | `CLIENT_URL` | **leave blank for now** — filled in at step 7 |
   | `GEMINI_API_KEYS` | your existing keys, comma-separated |
   | `R2_ACCOUNT_ID` etc. | all four from step 2 |
   | `GMAIL_USER` | `notemind.ai.app@gmail.com` |
   | `GMAIL_APP_PASSWORD` | the 16-character app password from step 3 |

5. Deploy. **The first deploy will fail** with
   `CLIENT_URL is required in production` — that is expected and correct. It
   gets fixed in step 7.
6. Copy your API URL: `https://<something>.onrender.com`

---

## 6. Deploy the client to Vercel  ·  10 min

1. [vercel.com](https://vercel.com) → sign up with GitHub → **Add New** →
   **Project** → import `notemind-app`.
2. **Root Directory**: `client`. Leave everything else — it's already declared
   in `client/vercel.json`.
3. **Environment Variables**:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://<your-render-url>.onrender.com/api` |

   The `/api` on the end matters. Without it every request 404s.
4. Deploy, then copy your Vercel URL: `https://<something>.vercel.app`

---

## 7. Connect the two  ·  5 min

The API needs to know the client's origin, and that origin didn't exist until
step 6 — so this is a second pass, not a mistake.

1. Render → your service → **Environment** → set
   `CLIENT_URL` = `https://<your-vercel-url>.vercel.app`
   (no trailing slash).
2. **Manual Deploy** → **Deploy latest commit**.

This deploy should succeed.

---

## 8. Verify  ·  5 min

```bash
curl https://<your-render-url>.onrender.com/healthz
# expect: {"status":"ok","db":"connected","uptime":...}
```

Then in the browser, on your Vercel URL:

- [ ] Register an account
- [ ] Create a note
- [ ] Paste an image into a note, reload — it should still show
      *(this proves R2 + signed URLs)*
- [ ] Refresh directly on `/dashboard` — should load, not 404
      *(this proves the SPA rewrite)*
- [ ] Log out → **Forgot password** → check your inbox
      *(this proves Gmail sending; the mail arrives from
      notemind.ai.app@gmail.com)*

---

## 9. Make yourself admin  ·  2 min

There is no self-serve way to become admin, on purpose.

```bash
cd server
node scripts/set-admin.js notemind.ai.app@gmail.com
```

That runs against whatever `MONGO_URI` is in `server/.env` — so point it at
Atlas (step 1) first, not your local database.

Then open `/admin/login` on your Vercel URL. The **Live** badge should say
Live, not Offline. Offline means `CLIENT_URL` doesn't exactly match your Vercel
origin.

---

## 10. Keep the API warm  ·  5 min

Render's free tier sleeps after 15 minutes idle; the next request then takes
~50 seconds. Ping `/healthz` every 14 minutes to prevent it.

Easiest: [cron-job.org](https://cron-job.org) (free, no card) → new cron job →
URL `https://<your-render-url>.onrender.com/healthz`, every 14 minutes.

Or commit `.github/workflows/keep-warm.yml` — the YAML is in `DEPLOY.md`.

---

## Optional: Google Sign-In

Skip unless you want it. Needs both halves or it does nothing.

1. [Google Cloud Console](https://console.cloud.google.com) → **APIs &
   Services** → **Credentials** → **Create OAuth client ID** → Web application.
2. **Authorized JavaScript origins**: your Vercel URL.
3. Set the same Client ID in **both** places:
   - Render: `GOOGLE_CLIENT_ID`
   - Vercel: `VITE_GOOGLE_CLIENT_ID`
4. Redeploy both.

Existing password users connect Google from **Account → Sign-in methods** —
signing in with Google won't adopt an existing account by email, which is
deliberate (it was an account-hijacking hole).

---

## After launch

Not blockers, but the next things worth doing:

- **Back up the database** before any schema change. M0 has no automated backups.
- **Narrow the CSP.** `client/vercel.json` has `connect-src https: wss:` because
  the API origin is a build-time variable. Now that it's fixed, set it to your
  exact Render origin.
- **Watch your Gemini spend.** Capped at 200 AI calls per user per day
  (`DAILY_AI_CALL_LIMIT`); lower it if the free tier gets tight.
- **Add Sentry** (`SENTRY_DSN`) so production errors reach you instead of
  scrolling past in Render's log viewer.
