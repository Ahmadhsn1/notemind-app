// Name of the Cache Storage bucket the service worker (public/sw.js) uses
// for stale-while-revalidate note GETs. Kept in one place since it must stay
// in sync between the SW and every place client code clears it.
const API_CACHE_NAME = 'notemind-api-v1';

// Clears the offline note-read cache so a stale response from one account
// can never be served to whoever is logged in next on the same browser —
// needed both on explicit logout and on a 401-triggered session expiry.
export const clearApiCache = () => {
  if ('caches' in window) caches.delete(API_CACHE_NAME);
};
