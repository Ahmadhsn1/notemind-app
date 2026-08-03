// Prefix of the Cache Storage buckets the service worker (public/sw.js) uses
// for stale-while-revalidate note GETs. The SW appends the user id, so there
// is one bucket per account — this must stay in sync with API_CACHE_PREFIX
// there.
const API_CACHE_PREFIX = 'notemind-api-';

// Clears every account's offline note-read cache.
//
// Called on explicit logout and on 401 session expiry. Note that neither
// covers the case this partitioning actually exists for: closing the browser
// clears sessionStorage but leaves Cache Storage intact, and no client code
// runs at that point to clean up. Per-user bucket names are what make that
// safe — a returning user can only ever be served their own cached notes.
// This function is the belt to that braces.
export const clearApiCache = async () => {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith(API_CACHE_PREFIX)).map((key) => caches.delete(key)));
};
