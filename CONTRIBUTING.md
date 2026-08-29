# Contributing to NoteMind

Thanks for taking the time to look at the internals. This is primarily a
personal project, but issues and pull requests are welcome.

## Ground rules

- **Open an issue before a large PR.** Small fixes (typos, obvious bugs, docs)
  can go straight to a PR. Anything that changes behaviour, adds a dependency,
  or touches the security model should start as an issue so the approach can be
  agreed first.
- **No regressions.** Existing behaviour does not change without a deliberate,
  called-out reason. If a change alters an API response shape, a stored data
  format, or an auth rule, say so explicitly in the PR description.
- **Match the surrounding code.** Naming, comment density, and structure should
  read like the file you are editing.

## Project layout

`client/` and `server/` are two independent npm projects — no workspace
tooling, no shared `package.json`. Install and run each separately. See
[`README.md`](README.md#architecture) for the full architecture.

```bash
# server/
npm install
cp .env.example .env      # fill MONGO_URI, JWT_SECRET, GEMINI_API_KEY
npm run dev

# client/  (second terminal)
npm install
npm run dev
```

Requires Node >= 20 (`.nvmrc` pins 24 — run `nvm use`).

## Before you open a PR

Run the same checks CI runs:

```bash
# server/
npm test                  # Vitest + Supertest, in-memory MongoDB — no setup needed

# client/
npm run lint
npm run build
```

Both must pass. The server suite runs against an ephemeral in-memory MongoDB,
so there is nothing to install or reset.

### Tests

New backend behaviour needs a test, and the bar is specific: **a test that
still passes when the feature it covers is broken is worse than no test.** The
existing suite was validated by reintroducing previously-shipped bugs and
confirming each was caught. If you add a test, delete the code it exercises
locally and confirm it fails before submitting.

Coverage here is targeted at the invariants the security model rests on
(ownership checks, session revocation, cascade integrity, quota accounting),
not at line percentage.

## Commit and PR style

- Present-tense, imperative commit subjects (`Add`, `Fix`, `Refactor`), no
  trailing period.
- One logical change per PR where practical.
- The PR description should answer: what changed, why, and what a reviewer is
  most likely to question.

## Security

Do not open a public issue for a vulnerability. See
[`SECURITY.md`](.github/SECURITY.md).
