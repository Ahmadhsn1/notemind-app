# Why vercel.json looks the way it does

Three things here are easy to get wrong and break the app in ways that are
hard to diagnose from the browser.

## 1. The rewrite must NOT swallow `sw.js`

This is a single-page app, so every route (`/dashboard`, `/account`, a reset
link at `/reset-password?token=…`) has to serve `index.html` — otherwise a
direct visit or a refresh returns 404.

The naive rule is `"source": "/(.*)" → "/index.html"`, which also rewrites
`/sw.js`. The browser then receives HTML with a `text/html` content type when
it asks for the service worker, registration fails, and the app silently loses
offline support with nothing obvious in the console.

The negative lookahead excludes the service worker, the manifest, the hashed
asset directory and the icons. Vercel checks the filesystem before applying
rewrites, but being explicit here means the behaviour doesn't depend on that.

## 2. `sw.js` must not be cached

`public/sw.js` is served at a stable URL and carries a build id stamped in by
the `swBuildId` plugin in `vite.config.js`. If a CDN caches it, browsers keep
running the previous build's worker — and since that worker decides which
assets are served from cache, a stale one can pin users to an old app version
indefinitely. `no-store` on this one file is what makes a deploy actually take
effect.

Hashed assets under `/assets/` get the opposite treatment: their filenames
change on every build, so they're safe to cache forever.

## 3. Headers live here, not in `public/_headers`

`_headers` is Cloudflare Pages syntax. Vercel ignores that file completely —
it would sit there looking like security config while doing nothing. The CSP
and friends are therefore defined in `vercel.json`.

Two CSP notes:

- `'unsafe-inline'` in `script-src` is required by the pre-paint theme script
  in `index.html`. Removing it means moving that script to a hashed external
  file, which reintroduces a flash of the wrong theme on load unless done
  carefully.
- `connect-src` is deliberately broad (`https: wss:`) because the API origin
  is a build-time variable (`VITE_API_URL`) this static file can't
  interpolate. Once the API host is fixed, narrow it to that exact origin —
  it's the single highest-value tightening available here.
