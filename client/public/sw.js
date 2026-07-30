// Offline read: cache-first for the app shell (same-origin static assets +
// navigations) so the app can still boot with no network, and
// stale-while-revalidate for note API GETs so previously-loaded notes/lists
// render offline too. This is deliberately read-only — no request queueing
// or background sync, so creates/edits/deletes still require a connection
// (see CLAUDE.md/plan: "offline read, not full write-sync").
const STATIC_CACHE = 'notemind-static-v1';
const API_CACHE = 'notemind-api-v1';
const CURRENT_CACHES = new Set([STATIC_CACHE, API_CACHE]);

self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.filter((key) => !CURRENT_CACHES.has(key)).map((key) => caches.delete(key)));
			await self.clients.claim();
		})()
	);
});

// Matched by pathname alone (not origin) since the API can be cross-origin
// relative to the app (e.g. localhost:5000 vs localhost:5173 in dev, or a
// separate API subdomain in prod). Only GET list/detail reads are cached —
// /ask, /search, /digest, /suggest-title, /ai-assist etc. are excluded since
// they either aren't idempotent reads of "a note" or aren't meant to work
// offline.
const isNoteReadPath = (pathname) =>
	pathname === '/api/notes' || /^\/api\/notes\/[a-f0-9]{24}$/.test(pathname);

const cacheFirst = async (request, cacheName) => {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	if (cached) return cached;

	const response = await fetch(request);
	if (response.ok) cache.put(request, response.clone());
	return response;
};

// Navigations (the HTML shell) use network-first instead: index.html is
// unhashed, so cache-first would serve it forever once cached, including
// after a new deploy replaces the hashed JS/CSS files it references —
// stranding returning users on a shell pointing at assets that no longer
// exist on the server. Hashed static assets themselves stay cache-first
// above, since a new deploy gives them a new URL anyway.
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

self.addEventListener('fetch', (event) => {
	const { request } = event;
	// Mutations always go straight to the network — no offline write support.
	if (request.method !== 'GET') return;

	const url = new URL(request.url);

	if (isNoteReadPath(url.pathname)) {
		event.respondWith(staleWhileRevalidate(request, API_CACHE));
		return;
	}

	if (url.origin === self.location.origin) {
		event.respondWith(request.mode === 'navigate' ? networkFirst(request, STATIC_CACHE) : cacheFirst(request, STATIC_CACHE));
	}
});
