import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// public/sw.js is copied verbatim by Vite, so it can't use import.meta.env.
// This stamps a per-build id into it after the copy.
//
// Without it the static cache name was a hardcoded 'v1' that nothing bumped,
// so every deploy's hashed asset bundles piled up in the same bucket forever
// — unbounded storage growth that eventually surfaces as an opaque
// QuotaExceededError. Changing the name is also what makes the SW's activate
// handler drop the previous build's assets.
const swBuildId = () => ({
  name: 'sw-build-id',
  apply: 'build',
  closeBundle() {
    // import.meta.dirname, not __dirname — Vite's native config loader warns
    // that CommonJS globals here stop working in a future major.
    const swPath = resolve(import.meta.dirname, 'dist/sw.js')
    try {
      const source = readFileSync(swPath, 'utf8')
      writeFileSync(swPath, source.replace(/__BUILD_ID__/g, Date.now().toString(36)))
    } catch {
      // No dist/sw.js (e.g. a library build) — nothing to stamp.
    }
  },
})

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // import.meta.env.* is inlined at build time, so a production build without
  // VITE_API_URL silently bakes the http://localhost:5000/api fallback from
  // src/api/axios.js into the shipped bundle: the app loads and renders, then
  // every request fails as blocked mixed content on an HTTPS site with
  // nothing explaining why.
  //
  // This check has to live here rather than as a module-level throw in
  // application code — Vite never executes app modules during a build, so
  // such a throw would only fire in the browser, turning a broken-API deploy
  // into a blank page. Failing the build is the last point where it's cheap.
  if (command === 'build' && !env.VITE_API_URL) {
    throw new Error(
      'VITE_API_URL is not set.\n' +
      'A production build without it would ship a hardcoded http://localhost:5000/api.\n' +
      'Set it in the build environment (Vercel > Project > Settings > Environment Variables).'
    )
  }

  return {
    plugins: [react(), tailwindcss(), swBuildId()],
  }
})
