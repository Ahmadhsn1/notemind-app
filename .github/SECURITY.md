# Security Policy

## Reporting a vulnerability

**Do not open a public GitHub issue for security problems.**

Report privately through GitHub's
[**Report a vulnerability**](https://github.com/Ahmadhsn1/notemind-ai/security/advisories/new)
form (Security tab → Advisories). If you cannot use that, open a minimal issue
titled "security contact request" with no details and you will be given a
private channel.

Please include:

- A description of the issue and its impact
- Steps to reproduce, or a proof of concept
- Affected area (`client/`, `server/`, a specific route or component)

You can expect an acknowledgement within a few days. Please give a reasonable
window to ship a fix before any public disclosure.

## Scope

This is a portfolio project without a funded bug-bounty program, but the
following are explicitly in scope and taken seriously:

- Authentication / session handling (JWT verification, revocation, Google
  Sign-In linking)
- Authorization — any path that returns another user's note, flashcard, or
  account data
- The unauthenticated public-share route (`/api/public/notes/:token`)
- Signed asset URLs (`/uploads` HMAC signing and verification)
- HTML sanitisation of note content (stored XSS)
- Admin surface privilege escalation
- AI quota / rate-limit bypass

## Not in scope

- Findings that require a compromised host, database, or Gemini API key
- Missing rate limits on endpoints that already have one at a higher tier
- Self-XSS, or issues only reproducible with browser extensions/devtools
- Reports from automated scanners without a demonstrated exploit
- `npm audit` transitive advisories already documented as accepted risks in
  `README.md` (react-router RSC-mode CSRF; `archiver` → `brace-expansion`
  glob DoS) — both non-exploitable given how this app uses them

## Handling

Fixes for confirmed issues land on `main` with a GitHub Security Advisory
published after users have had time to update. Reporters are credited unless
they ask not to be.
