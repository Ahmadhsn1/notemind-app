# NoteMind — remaining work

Self-contained handoff. Paste this whole file into a fresh chat and it has
everything needed to continue without prior context.

---

## Project

**NoteMind** — MERN note-taking app with Google Gemini AI features (auto-tagging,
cross-note Q&A, semantic search, title suggestions, writing assist, weekly
digest), plus spaced-repetition flashcards, note version history, a wikilink
graph view, daily note-resurfacing, an admin dashboard, and PWA support.

- `client/` — Vite + React 19 SPA, Tailwind 4, deploys to **Vercel**
- `server/` — Express 5 + Mongoose + Socket.IO, deploys to **Render** (Docker)
- Two independent npm projects, no workspace tooling — install/run separately
- Node >= 20. `server/`: `npm start`, `npm test`. `client/`: `npm run dev`,
  `npm run build`, `npm run lint`
- Repo: `github.com/Ahmadhsn1/notemind-app`, branch `main`

**Current state:** 109 tests passing (9 files, Vitest + Supertest against an
in-memory MongoDB), 0 npm vulnerabilities, client lint and build clean.

Read `CLAUDE.md` (local, gitignored) for full architecture notes, `DEPLOY.md`
for deployment reference, `LAUNCH.md` for the human deploy checklist.

**Why Render and not all-Vercel:** Vercel is serverless. It supports WebSockets
now, but a connection is pinned to whichever function instance accepted it and
there is no cross-instance broadcasting — so `broadcastAdminUpdate` and
`pushNotificationToUser` would emit into a void for sockets held elsewhere. The
admin Live badge would show green while nothing updated. Don't "simplify" this
to one platform without adding a Redis pub/sub backplane.

---

## Already done — do not redo

A full security/production audit was completed and every P0 and P1 fixed.
Notable invariants that now have tests; breaking them will fail CI:

- All six note/user delete paths funnel through `services/dataCleanup.js`.
  They previously each cleaned up a different subset, leaving orphaned
  flashcards that kept quizzing users on deleted notes.
- `protect` loads the user every request, so deleted/suspended accounts lose
  access immediately rather than keeping it for the token's remaining 7 days.
- `POST /auth/google` refuses to adopt an existing account by email
  (account pre-hijacking hole). Linking happens from Account → Sign-in methods.
- `passwordChangedAt` invalidates sessions issued before a password reset.
- Note images use per-file expiring HMAC signatures; `/uploads` was public.
- Service worker API cache is partitioned per user; it previously served one
  account's notes to the next on a shared browser.
- Per-user daily AI quota (`DAILY_AI_CALL_LIMIT`, default 200). Note saves
  consume it *softly* — an exhausted quota must never block saving a note.
- Rate limiting uses a Mongo-backed store (`services/rateLimitStore.js`,
  hand-written because `rate-limit-mongo` ships a vulnerable `underscore`).
- Config fails fast at boot (`config/env.js`); uploads go to Cloudflare R2.
- Password reset by email with two backends (Gmail SMTP / Resend).
- All notes are fetched via `api/notes.js#fetchAllNotes`, not just the first
  200 — backlinks, graph and folder counts derive from that array and were
  *wrong*, not merely truncated, when it was capped.

---

## A. Blocking launch — human steps

These need accounts and a browser. See `LAUNCH.md` for click-by-click detail.

| # | Step | Time | Produces |
|---|---|---|---|
| 1 | MongoDB Atlas M0 | 10 min | `MONGO_URI` |
| 2 | Cloudflare R2 bucket + token | 10 min | 4 `R2_*` vars |
| 3 | Gmail App Password (2FA required first) | 5 min | `GMAIL_USER`, `GMAIL_APP_PASSWORD` |
| 4 | Deploy API to Render (root `server`, Docker, health `/healthz`) | 15 min | API URL |
| 5 | Deploy client to Vercel (root `client`) | 10 min | Client URL |
| 6 | Set `CLIENT_URL` on Render, redeploy | 5 min | — |
| 7 | `node scripts/set-admin.js notemind.ai.app@gmail.com` | 2 min | admin access |
| 8 | Cron pinging `/healthz` every 14 min (cron-job.org) | 5 min | no cold starts |

Gotchas that will otherwise cost an hour:

- **The first Render deploy fails on purpose** with `CLIENT_URL is required in
  production`. The Vercel URL doesn't exist yet. Fixed at step 6.
- `VITE_API_URL` must end in `/api`, and is baked in at **build** time —
  changing it requires a redeploy, not just an env edit.
- `set-admin.js` uses whatever `MONGO_URI` is in `server/.env`. Point it at
  Atlas first, or you'll make yourself admin on the local database.
- The current local database is `mongodb://localhost:27017/notemind` — that
  data will **not** move to Atlas automatically. Migrate with `mongodump` /
  `mongorestore`, or start fresh.

---

## B. Small, self-contained code tasks

Good first tasks. Each is independent.

1. **Push the CI workflow.** `.github/workflows/ci.yml` exists on disk but
   isn't on GitHub — the token lacks `workflow` scope. Fix:
   `gh auth refresh -s workflow`, then commit and push `.github/`.

2. **Narrow the CSP.** `client/vercel.json` has `connect-src 'self' https: wss:`
   because the API origin was unknown at write time. Once the Render URL is
   fixed, replace `https: wss:` with that exact origin. Highest-value security
   tightening available and takes one line.

3. **Add Sentry.** `SENTRY_DSN` is already read in `config/env.js` and
   `@sentry/node` is installed, but nothing initialises it. Wire it into
   `server/app.js` and the error handler so production errors are aggregated
   instead of scrolling past in Render's log viewer.

4. **Fix the DST streak bug.** `getNoteStreak` / `getNoteActivity` in
   `noteController.js` and `getResurfaceStreak` in `resurfaceController.js`
   walk *local* midnights while stepping by a fixed `86_400_000` ms. On a
   spring-forward day the local day is 23h, so the step skips the transition
   day entirely and the streak silently resets. `flashcardController`'s
   `getReviewStreak` is already correct (all UTC) — make the other three match
   it. Add tests around a DST boundary.

5. **Prevent demoting the last admin.** `adminController.updateUserRole` and
   `bulkUserAction` only block self-demotion, so two admins can demote each
   other and leave zero. Recovery then needs shell access to run
   `set-admin.js`. Refuse the change when it would drop the admin count to 0.

6. **Confirm before deleting a sent notification.** `Admin.jsx`'s
   `handleDeleteNotification` fires immediately on click; every other
   destructive action on that page goes through `ConfirmModal`.

7. **Warn on discarding an unsaved note.** `NoteFormModal.jsx`'s backdrop
   click calls `onClose`, which calls `resetForm()` unconditionally. Write 500
   words, mis-click 4px outside the card, it's gone. Add a dirty check.

---

## C. Accessibility — one focused pass

Currently **zero** files use `role="dialog"` or `aria-modal`, across 10 modal
components. Escape is handled in only 6 files, and *not* in the delete-forever
confirm.

Needed: focus trap, focus restore on close, `role="dialog"` + `aria-modal`,
Escape everywhere, and `aria-label` on icon-only buttons. Best done as one
shared `useModal` hook or a `<Modal>` wrapper applied to all 10 rather than
patching each. This is table stakes for a B2B buyer and currently makes the
app unusable with a keyboard or screen reader.

---

## D. Performance

1. **Bundle is 1.0 MB** (~325 KB gzipped) in a single chunk. Add route-level
   code splitting with `React.lazy` — `Admin.jsx` (703 lines) and
   `GraphView.jsx` (d3-force) are the obvious candidates and are never needed
   on first paint.

2. **Every editor keystroke re-renders the whole note grid.**
   `NoteEditor.jsx`'s `onUpdate` lifts state to `Dashboard`, `NoteCard` isn't
   memoized, and `filteredNotes` + sort recompute each render. With a few
   hundred notes this is visible input lag. Memoize `NoteCard`, and `useMemo`
   the filter/sort.

3. **`Admin.jsx` runs a 1-second interval forever**, re-rendering the entire
   703-line page on every tab, to keep one "Last active" column fresh. Scope it
   to the Users tab, or move the ticking into that cell.

---

## E. Scale ceilings — not urgent, will bite later

1. **`Notification.recipients` is one unbounded array in one document.** An
   "all users" broadcast writes every user id into a single doc; `$addToSet`
   on `readBy` rewrites the whole thing per read. Hits Mongo's 16 MB document
   limit in the low hundreds of thousands of users. Needs a separate
   `NotificationRecipient` collection.

2. **`getAdminUsers` `$lookup`s every note as a full document** (body,
   contentHtml, embedding) just to take `$size`. One user with >16 MB of notes
   makes the entire admin Users tab fail with `BSONObjectTooLarge`. Use
   `$lookup` with a `pipeline` + `$count`, and paginate the user list.

3. **AI retrieval is an in-process cosine scan**, capped at
   `AI_RETRIEVAL_MAX_NOTES = 500` to stop one request stalling the event loop.
   Real fix is a vector index — Atlas Vector Search, which the M0 free tier
   does not support, so this needs a paid tier or an external vector store.

4. **Admins can't see images inside another user's note** — `sign-images` only
   signs files the caller owns, so they render as placeholders. Deliberate:
   minting URLs for another user's private files is a bigger decision than the
   moderation feature required. Revisit if moderation needs it.

5. **Admin reads of user note content are not audited.** Mutations are logged
   to `AdminAuditLog`; `getUserNotes` and `getNoteDetail` are not. For a
   private-notes product this is the single most sensitive action an admin can
   take.

6. **No migration strategy.** Three ad-hoc scripts in `server/scripts/` run by
   hand. Fields added later (`suspended`, `lastActiveAt`, `googleId`,
   `passwordChangedAt`) exist only as Mongoose read-defaults, so raw
   aggregations `$match`ing them silently miss pre-existing users.

7. **Atlas M0 has no automated backups.** Take a `mongodump` before any schema
   change. There is no undo.

---

## F. Product features — not built at all

Ordered by how much they block being a real SaaS.

1. **Email verification on signup.** Anyone can register
   `ceo@yourcustomer.com`. The email plumbing already exists
   (`services/email.js`) — this is a token + a gate, mirroring the password
   reset flow closely.

2. **Billing / plans / quotas.** No revenue mechanism; every user is unlimited
   on a metered paid AI API. `AiUsage` already tracks per-user daily calls, so
   the metering half exists — needs Stripe plus a plan tier on `User` and
   per-tier limits in `middleware/aiQuota.js`.

3. **Terms of Service and Privacy Policy pages.** Legally required to process
   EU/UK/CA personal data. No route, no page, no signup consent checkbox.
   Genuinely blocking for a public launch.

4. **Account deletion grace period.** Deletion is immediate and irreversible.
   No undo, and with no DB backups it's unrecoverable by you either. A 30-day
   soft-delete would match the existing note-trash pattern.

5. **Landing page.** `/` redirects straight to `/login` or `/dashboard`. No
   marketing surface at all.

6. **Onboarding.** `utils/noteTemplates.js` exists but there's no first-run
   tour, sample content, or activation flow.

7. **2FA.** Password + 7-day JWT is the entire auth story.

8. **404 route.** Unknown client paths currently render nothing useful.

9. **User-facing security log.** `AdminAuditLog` covers admins only; a user
   can't see their own login history.

---

## Conventions to follow

- **Comments explain *why*, not *what*.** This codebase documents the reasoning
  behind non-obvious decisions and the bugs they prevent. Match that.
- Controllers `throw new HttpError(status, message)`; Express 5 forwards
  rejections to `middleware/errorHandler.js`. Never leak `error.message`.
- Note-scoped endpoints use `loadOwnedNote` — fetch, then check ownership.
- Request bodies are validated with Zod in `validators/`, applied via
  `validateBody`. Note that it *replaces* `req.body` with the parsed result,
  so every key the controller reads must be declared or it's stripped.
- Tags and folders are normalised server-side (`normalizeTags`,
  `normalizeFolder`).
- Client uses the shared `api/axios.js` instance; a global 401 handler clears
  the session. Raw `fetch` is used only for streaming and blob downloads, and
  those bypass the interceptor.
- Run `npm test` (server) and `npm run lint && npm run build` (client) before
  considering anything done.
- Don't add a `Co-Authored-By` trailer to commits. `CLAUDE.md` and `.claude/`
  are gitignored and must stay local.
