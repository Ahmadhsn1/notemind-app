// Offline read: cache-first for the app shell (same-origin static assets +
// navigations) so the app can still boot with no network, and
// stale-while-revalidate for note API GETs so previously-loaded notes/lists
// render offline too. Deliberately read-only — no request queueing or
// background sync, so creates/edits/deletes still require a connection.

// __BUILD_ID__ is replaced at build time (see the swBuildId plugin in
// vite.config.js). Without it the static cache name was a hardcoded 'v1' that
// nothing ever bumped, so every deploy's hashed asset bundles accumulated in
// the same bucket forever — unbounded client-side storage growth ending in an
// opaque QuotaExceededError. A new build id means the activate handler below
// drops the previous build's assets.
const BUILD_ID = '__BUILD_ID__';
const STATIC_CACHE = `notemind-static-${BUILD_ID}`;

// API responses are cached PER USER.
//
// Caching them under one shared name keyed only by URL leaked data across
// accounts: sessionStorage clears when the browser closes, but Cache Storage
// does not. So on a shared computer, user A browses their notes and closes
// the browser; user B opens the app, signs in, and stale-while-revalidate
// hands them A's cached note list from disk before revalidation resolves.
// Logout and 401 both cleared the cache, but simply closing the browser —
// the common case — did not.
const API_CACHE_PREFIX = 'notemind-api-';
const apiCacheFor = (userId) => `${API_CACHE_PREFIX}${userId}`;

const isCurrentCache = (name) => name === STATIC_CACHE || name.startsWith(API_CACHE_PREFIX);

self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.filter((key) => !isCurrentCache(key)).map((key) => caches.delete(key)));
			await self.clients.claim();
		})()
	);
});

// Matched by pathname alone (not origin) since the API can be cross-origin
// relative to the app (localhost:5000 vs :5173 in dev, a separate API host in
// prod). Only GET list/detail reads are cached — /ask, /search, /digest etc.
// either aren't idempotent reads of "a note" or aren't meant to work offline.
const isNoteReadPath = (pathname) =>
	pathname === '/api/notes' || /^\/api\/notes\/[a-f0-9]{24}$/.test(pathname);

// Any write to the notes API invalidates that user's cached reads.
const isNoteWritePath = (pathname) => pathname.startsWith('/api/notes');

// The request already carries `Authorization: Bearer <jwt>` (added by the
// axios interceptor), and the token's payload contains the user id — so the
// cache can be partitioned without the page having to message the SW, and
// without any window where a fetch is handled before the SW knows who is
// signed in. Only the `id` claim is read; the signature is irrelevant here
// because this decides a cache bucket, never access.
const userIdFromRequest = (request) => {
	const header = request.headers.get('Authorization');
	if (!header || !header.startsWith('Bearer ')) return null;
	try {
		const payload = header.slice(7).split('.')[1];
		if (!payload) return null;
		const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
		const id = JSON.parse(json).id;
		return typeof id === 'string' && /^[a-f0-9]{24}$/.test(id) ? id : null;
	} catch {
		return null;
	}
};

const cacheFirst = async (request, cacheName) => {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	if (cached) return cached;

	const response = await fetch(request);
	if (response.ok) cache.put(request, response.clone());
	return response;
};

// Navigations (the HTML shell) use network-first: index.html is unhashed, so
// cache-first would serve it forever once cached, including after a deploy
// replaced the hashed JS/CSS it references — stranding returning users on a
// shell pointing at assets that no longer exist.
const networkFirst = async (request, cacheName) => {
	const cache = await caches.open(cacheName);
	try {
		const response = await fetch(request);
		if (response.ok) cache.put(request, response.clone());
		return response;
	} catch (err) {
		const cached = (await cache.match(request)) || (await cache.match('/dashboard')) || (await cache.match('/'));
		if (cached) return cached;
		throw err;
	}
};

const staleWhileRevalidate = async (request, cacheName) => {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	const network = fetch(request)
		.then((response) => {
			if (response.ok) cache.put(request, response.clone());
			return response;
		})
		.catch(() => null);

	return cached || (await network) || Response.error();
};

// A mutation makes this user's cached note reads stale immediately. Without
// this the client refetched after every create/delete and the SW answered
// from cache, so in a production build a new note could fail to appear (and a
// deleted one fail to disappear) until some later refetch happened to miss.
const invalidateUserApiCache = async (userId) => {
	if (!userId) return;
	await caches.delete(apiCacheFor(userId));
};

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	if (request.method !== 'GET') {
		// Mutations always go straight to the network — no offline write
		// support — but their success invalidates the read cache.
		if (isNoteWritePath(url.pathname)) {
			const userId = userIdFromRequest(request);
			event.respondWith(
				fetch(request).then((response) => {
					if (response.ok) event.waitUntil(invalidateUserApiCache(userId));
					return response;
				})
			);
		}
		return;
	}

	if (isNoteReadPath(url.pathname)) {
		const userId = userIdFromRequest(request);
		// No identifiable user (signed out, or a request without the header)
		// must never read from or write to a per-user bucket.
		if (!userId) return;
		event.respondWith(staleWhileRevalidate(request, apiCacheFor(userId)));
		return;
	}

	if (url.origin === self.location.origin) {
		event.respondWith(request.mode === 'navigate' ? networkFirst(request, STATIC_CACHE) : cacheFirst(request, STATIC_CACHE));
	}
});
