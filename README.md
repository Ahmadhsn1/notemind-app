# NoteMind

An AI-augmented note-taking platform built on the MERN stack. Notes are
semantically searchable, answerable in natural language, convertible into
spaced-repetition flashcards, and connected to each other through wikilinks
rendered as a force-directed graph.

Beyond the product surface, this repository is a study in taking a working
prototype to production: session revocation, per-file signed asset URLs,
cascading data-integrity guarantees, per-user cost controls on metered AI, and
a test suite built specifically around the invariants the security model rests
on.

```
109 tests · 0 vulnerabilities · 74 API routes · 9 collections
```

---

## Contents

- [Feature overview](#feature-overview)
- [Architecture](#architecture)
- [Engineering notes](#engineering-notes)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Testing](#testing)
- [Operations](#operations)
- [Deployment](#deployment)

---

## Feature overview

### Notes

A Tiptap rich-text editor with slash commands, task lists, code blocks, image
paste-and-upload, and `[[wikilink]]` note references. Notes carry tags,
folders, pins, reminders, and a full lifecycle — active, archived, and a trash
that hard-deletes after 30 days.

Every content-touching save snapshots the previous version, so any edit is
reversible; restoring a version snapshots the pre-restore state first, making
restores themselves undoable.

### AI (Google Gemini)

| Capability | How it works |
|---|---|
| **Cross-note Q&A** | Retrieval over the user's notes, answer streamed token-by-token |
| **Semantic search** | 768-dimensional embeddings, cosine similarity, keyword fallback |
| **Auto-tagging & summaries** | Strict-JSON prompting with fence stripping and retry |
| **Title suggestions** | Generated from note body on demand |
| **Writing assist** | Rewrite, expand, summarise, fix tone — applied inline in the editor |
| **Weekly digest** | Recap widget over the last seven days |
| **Flashcard generation** | Q&A pairs extracted from a note, fed into SM-2 review scheduling |

Retrieval prefers semantic similarity per note and falls back to keyword
overlap when an embedding is unavailable — so a note saved before embeddings
existed, or during a Gemini outage, still participates in results rather than
disappearing from them.

### Knowledge tools

- **Spaced repetition** — SM-2 scheduling, due queue, review streaks
- **Graph view** — d3-force layout of wikilinked notes; unlinked notes are
  listed separately rather than scattered as disconnected dots
- **Backlinks** — computed both directions, in-note
- **Daily resurfacing** — one older note surfaced per day, with a reflection
  streak keyed on actually replying, not merely viewing

### Accounts

Email/password and Google Sign-In, profile management, password change,
self-service data export (JSON and Markdown ZIP), and account deletion with
full cascade. Password reset by email with hashed, single-use, expiring
tokens.

### Admin

A separate authenticated surface with live-updating stats over WebSockets,
30-day growth charts, per-user note and flashcard inspection, content
moderation, bulk user actions, broadcast notifications, an append-only audit
log, and operational visibility into the Gemini key pool and rate-limit
configuration.

### Platform

Installable PWA with an offline-read service worker: cache-first hashed
assets, network-first app shell, and stale-while-revalidate note reads
partitioned per user.

---

## Architecture

```
notemind-app/
├── client/                        React 19 · Vite · Tailwind 4 → Vercel
│   ├── public/sw.js               Offline-read service worker
│   ├── vercel.json                SPA routing + security headers
│   └── src/
│       ├── api/                   Axios instance, 401 handling, pagination
│       ├── components/editor/     Tiptap extensions (slash menu, wikilinks)
│       ├── context/               Auth, theme, toast, notifications
│       ├── pages/                 Route-level views
│       └── utils/                 Pure helpers
│
└── server/                        Express 5 · Mongoose · Socket.IO → Render
    ├── app.js                     Express app (no listener — mountable in tests)
    ├── server.js                  Bootstrap: connect, listen, graceful shutdown
    ├── config/env.js              Zod-validated configuration, fails fast
    ├── controllers/               Route handlers
    ├── middleware/                Auth, admin, validation, rate limit, AI quota
    ├── models/                    9 Mongoose schemas
    ├── routes/                    74 route definitions
    ├── services/                  AI, email, storage, cleanup, sockets, logging
    ├── scripts/                   Maintenance and migration
    ├── tests/                     Vitest + Supertest, in-memory MongoDB
    └── validators/                Zod request schemas
```

**Layering.** `routes → middleware → controllers → services → models`.
Controllers throw `HttpError(status, message)`; Express 5 forwards rejected
async handlers to a central error handler that maps known error types to 4xx
and everything else to a bare 500, never leaking internals.

**Client/server split.** Two independent npm projects, deployed separately.
The API is a long-running process because Socket.IO requires one — see
[Deployment](#deployment).

---

## Engineering notes

The decisions below are the ones a reader is most likely to question.

### Sessions are verified, not merely decoded

A JWT signature proves a token was issued; it does not prove the account still
exists or is still permitted. `protect` therefore loads the user on every
authenticated request, so deletion and suspension take effect immediately
rather than at token expiry up to seven days later. This costs nothing extra —
the middleware already wrote `lastActiveAt` per request.

`passwordChangedAt` extends this into real revocation: a password reset
invalidates every token issued before it, which matters because a reset is
usually performed *because* an account is believed compromised.

### One cleanup path, not six

Deleting a note or a user touches versions, flashcards, resurfacing history,
notification references, wikilink back-references, and object storage. Six
call sites each implementing that cascade independently is six chances to
forget one — the observed symptom being flashcards that kept quizzing users on
notes they had permanently deleted.

All six now funnel through `services/dataCleanup.js`, and the test suite
asserts zero orphans per path.

### Signed asset URLs

`<img>` cannot send an `Authorization` header, and this app authenticates with
bearer tokens rather than cookies — so putting `/uploads` behind auth
middleware would break every image in every note.

Instead, a protected endpoint verifies ownership and returns per-file HMAC
signatures with a one-hour expiry; the public route only verifies. Signing
each file individually — rather than issuing one token covering a user's whole
library — keeps a leaked URL worth exactly one image, as it was before, while
adding an expiry it never had.

### Metered AI needs per-user accounting

An IP-based rate limiter cannot answer "who ran up this bill", counts an
office behind one NAT as a single user, and resets on deploy. `AiUsage` tracks
calls per user per UTC day via an atomic upsert, so concurrent requests cannot
both slip through a stale read.

Note saves consume that quota **softly**: every save triggers a billed
embedding call, but an exhausted quota degrades the note to keyword matching
rather than blocking the save. "You have used your AI quota, so you can no
longer write notes" is not a defensible product behaviour.

### Fail fast on configuration

A mistyped `JWT_SECRET` used to bind the port, pass the health check, and then
return 500 on every login — a total outage that looked like a healthy deploy.
`config/env.js` validates everything at boot and exits with a readable message.

Paired variables are checked together, because half a feature's configuration
is worse than none: a partially configured email backend silently falls back
to logging, which is indistinguishable from working until a real user needs a
password reset.

### Per-user offline cache

`sessionStorage` clears when the browser closes; Cache Storage does not. A
service worker cache keyed only by URL therefore served one account's notes to
the next person to sign in on a shared machine. The cache is now partitioned
by user id, derived from the token already present on the request — which
avoids the alternative design's race, where a fetch can be handled before the
worker learns who is signed in.

---

## Getting started

**Requirements:** Node >= 20 (`.nvmrc` pins 24 — run `nvm use`), MongoDB
(local or Atlas), and a [Gemini API key](https://ai.google.dev/) for AI
features.

```bash
git clone https://github.com/Ahmadhsn1/notemind-app.git
cd notemind-app
```

**Server**

```bash
cd server
npm install
cp .env.example .env      # then fill in MONGO_URI, JWT_SECRET, GEMINI_API_KEY
npm run dev               # http://localhost:5000
```

**Client** — in a second terminal:

```bash
cd client
npm install
npm run dev               # http://localhost:5173
```

The app runs without a Gemini key; AI features degrade to unavailable rather
than taking the server down with them. Image uploads fall back to local disk
when object storage is unconfigured.

**Grant yourself admin:**

```bash
cd server && node scripts/set-admin.js you@example.com
```

---

## Configuration

Full annotations live in `server/.env.example`. Summary:

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Session signing key — 32+ chars in production |
| `CLIENT_URL` | production | Allowed browser origins (CORS + Socket.IO) |
| `GEMINI_API_KEYS` | — | Comma-separated key pool; AI disabled if absent |
| `R2_*` (×4) | production | Cloudflare R2 object storage |
| `GMAIL_USER` + `GMAIL_APP_PASSWORD` | — | Email backend, no domain required |
| `RESEND_API_KEY` + `EMAIL_FROM` | — | Email backend, needs a verified domain |
| `GOOGLE_CLIENT_ID` | — | Google Sign-In; must match the client's |
| `DAILY_AI_CALL_LIMIT` | — | Per-user daily AI cap (default 200) |
| `SENTRY_DSN`, `LOG_LEVEL` | — | Observability |

Client: `VITE_API_URL` (required at build time), `VITE_GOOGLE_CLIENT_ID`.

### Gemini key pool

`GEMINI_API_KEYS` accepts any number of comma-separated keys, round-robined
across those not in cooldown. On a 429 the pool inspects the quota type: a
`PerDay` violation cools that key until the next Pacific midnight (DST-safe via
`Intl`), anything else uses a short backoff. Google's own `retryDelay` hint is
deliberately not trusted for daily quotas — it reports seconds for a limit that
resets in hours.

Note that keys from the same Google Cloud project usually share one quota
bucket; only keys from genuinely separate projects add capacity.

---

## API reference

74 routes. All `/api/notes`, `/api/flashcards`, `/api/admin`,
`/api/notifications` and `/api/resurface` endpoints require
`Authorization: Bearer <token>`.

<details>
<summary><b>Auth</b> — <code>/api/auth</code></summary>

| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Create an account |
| POST | `/login` | Exchange credentials for a JWT |
| POST | `/google` | Sign in with a Google ID token |
| POST | `/forgot-password` | Request a reset link |
| POST | `/reset-password` | Redeem a reset token |
| GET | `/me` | Current user, including linkage state |
| PUT | `/profile` | Update name and email |
| PUT | `/password` | Change password |
| POST | `/google/link` | Attach a Google identity to this session |
| DELETE | `/google/link` | Detach it |
| DELETE | `/account` | Delete the account and all its data |

</details>

<details>
<summary><b>Notes</b> — <code>/api/notes</code></summary>

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Paginated list; `?view=active\|archived\|trash` |
| POST | `/` | Create |
| GET · PUT · DELETE | `/:id` | Read · update · move to trash |
| POST | `/:id/restore` | Restore from trash |
| DELETE | `/:id/permanent` | Hard delete with full cascade |
| PATCH | `/:id/pin` · `/:id/archive` · `/:id/unarchive` | Lifecycle |
| GET | `/:id/versions` | Version history |
| POST | `/:id/versions/:versionId/restore` | Restore a version |
| POST | `/ask` | Cross-note Q&A (streamed) |
| POST | `/search` | Semantic search |
| GET | `/digest` | Weekly recap |
| GET | `/streak` · `/activity` | Writing streak and daily activity |
| POST | `/suggest-title` · `/ai-assist` · `/:id/ai-process` | AI helpers |
| GET · POST | `/:id/flashcards` | List · generate |
| GET | `/export/json` · `/export/markdown` | Full data export |
| POST | `/upload-image` · `/sign-images` | Upload · mint signed URLs |

</details>

<details>
<summary><b>Flashcards, notifications, resurfacing</b></summary>

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/flashcards/due` | Cards due for review |
| GET | `/api/flashcards/streak` | Review streak |
| POST | `/api/flashcards/:id/review` | Submit a review grade (SM-2) |
| DELETE | `/api/flashcards/:id` | Delete a card |
| GET | `/api/notifications` | Inbox |
| PATCH | `/api/notifications/:id/read` | Mark read |
| GET | `/api/resurface/today` | Today's resurfaced note |
| PATCH | `/api/resurface/today/viewed` | Mark seen |
| POST | `/api/resurface/today/reply` | Reflect (drives the streak) |
| GET | `/api/resurface/streak` | Reflection streak |

</details>

<details>
<summary><b>Admin</b> — <code>/api/admin</code>, requires <code>role: admin</code></summary>

| Method | Endpoint | Description |
|---|---|---|
| GET | `/stats` · `/growth` · `/system` | Metrics, 30-day series, ops status |
| GET | `/users` | All users with note/flashcard counts |
| GET | `/users/:id/notes` · `/users/:id/flashcards` | Per-user content |
| GET | `/users/:id/export/json` · `/export/markdown` | Support/GDPR export |
| PATCH | `/users/:id/role` · `/users/:id/suspend` | Role and suspension |
| POST | `/users/:id/reset-password` | Generate a temporary password |
| POST | `/users/bulk` | Bulk suspend/delete/role change |
| DELETE | `/users/:id` | Delete a user and all their data |
| GET · PATCH · DELETE | `/notes/:noteId…` | Content moderation |
| GET · POST · DELETE | `/notifications…` | Broadcasts |
| GET | `/audit-log` | Append-only record of admin actions |

Every admin mutation refuses to act on the acting admin's own account, and is
written to the audit log with a plain-text snapshot of the target — the target
may since have been deleted, and the log must stay readable.

</details>

Health check: `GET /healthz` (unauthenticated) returns process uptime and
database connectivity.

---

## Testing

```bash
cd server && npm test
```

Vitest + Supertest against an in-memory MongoDB — no external services, no
fixtures to reset, no shared state between runs. 109 tests across 9 files.

Coverage is targeted rather than exhaustive: it covers the invariants that
carry the security model, chosen so that breaking one fails loudly.

| Suite | Asserts |
|---|---|
| `authorization` | Every note route 403s a foreign note; admin gating; role changes apply to already-issued tokens |
| `session` | Deleted, suspended, malformed and expired sessions rejected; bad input is 4xx, never 500 |
| `dataCleanup` | Each delete path leaves zero orphans; streaks survive; backlinks are pruned |
| `security` | XSS vectors stripped; prototype-chain filter bypass closed; archive/trash exclusivity |
| `imageSignature` | Signatures bound to filename and expiry; unsigned and tampered requests refused |
| `passwordReset` | Tokens hashed, single-use, expiring; no account-existence oracle; prior sessions revoked |
| `googleLink` | Identity linking rules, including the account pre-hijacking case |
| `account` | Password/Google account state; deletion cascade |
| `email` | Provider selection; half-configured backends refuse to boot |

The suite was validated by reintroducing three previously fixed bugs and
confirming each was caught — a test that passes with the defect present is
worse than no test, because it manufactures confidence.

Client checks:

```bash
cd client && npm run lint && npm run build
```

---

## Operations

**Logging.** Structured JSON via `pino` with request and user correlation.
The redaction list covers authorization headers, passwords, note bodies,
`contentHtml`, embeddings and tokens — a raw Mongoose validation error embeds
the offending document, which for this app means note content in plaintext
logs.

**Rate limiting.** Auth, AI, upload, export and global limiters backed by a
custom MongoDB store. The obvious off-the-shelf package depends on a version
of `underscore` carrying an unpatched advisory; taking a known-vulnerable
transitive dependency in order to *fix* a security problem is a bad trade, so
the store is ~40 lines against the existing connection.

**Graceful shutdown.** `SIGTERM` drains in-flight requests, closes Socket.IO
with proper disconnect frames, and closes Mongoose — otherwise every deploy
severs streaming responses mid-write and triggers a client reconnect storm.

**Maintenance scripts** (`server/scripts/`):

| Script | Purpose |
|---|---|
| `set-admin.js` | Grant admin — deliberately not self-serve |
| `check-data-integrity.js` | Read-only referential audit across all collections |
| `fix-archived-trashed-notes.js` | Repair notes left in a contradictory state |
| `migrate-uploads-to-r2.js` | Idempotent local-disk → object-storage migration |
| `merge-ai-tags.js`, `fix-pasted-codeblock-notes.js` | Historical backfills |

---

## Deployment

| Component | Platform |
|---|---|
| Client | Vercel — static build, config in `client/vercel.json` |
| API | Render — Docker, health check `/healthz` |
| Database | MongoDB Atlas |
| Object storage | Cloudflare R2 |
| Email | Gmail SMTP or Resend |

Step-by-step instructions are in **[DEPLOY.md](DEPLOY.md)**; outstanding work
is tracked in **[REMAINING.md](REMAINING.md)**.

**Why the API is not also on Vercel.** Vercel supports WebSockets, but a
connection is pinned to whichever function instance accepted it, with no
cross-instance broadcasting. Admin live updates and notification pushes emit
to rooms spanning all connections — on serverless, a socket held by one
instance would never receive an event emitted from another. The badge would
read "Live" while nothing updated. Consolidating onto one platform requires a
Redis pub/sub backplane first.

CI runs client lint and build, the server test suite, and a Docker image build
on every push and pull request.

---

## Security summary

- Bearer-token sessions, verified against the database on every request
- Passwords hashed with bcrypt; reset tokens stored SHA-256 hashed — a fast
  hash is correct there, since a 32-byte random token has no dictionary to
  attack and lookup must stay a single indexed query
- Server-side HTML sanitisation with a tag/attribute allowlist matched to the
  editor's output, re-sanitised client-side before render as defence in depth
- Uploads validated by magic bytes, not declared MIME type; SVG excluded
  because it carries script and no byte check would catch it
- Ownership enforced per resource, never inferred from query scoping alone
- Zod validation on every write; unknown keys stripped, so no mass assignment
- `helmet`, CORS allowlist, CSP, body size limits, `trust proxy`
- No secrets in the repository; configuration validated at boot

---

## License

ISC

