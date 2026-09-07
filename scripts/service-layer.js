// ============================================================
//  scripts/service-layer.js  (NEW in v3)
//
//  The service layer sits between UI modules and Firestore.
//  It owns two responsibilities:
//
//  1. IN-MEMORY RESULT CACHE
//     Short-lived cache (default 2 min TTL) for read-heavy
//     operations like getListings() and getListingById().
//     Prevents redundant Firestore reads when the user
//     navigates back/forward within a session.
//
//  2. WRITE-THROUGH INVALIDATION
//     Every write (add/update/delete) invalidates the relevant
//     cache keys so the next read always returns fresh data.
//
//  Consumers: listings.js delegates all paginated reads here.
//  Real-time subscriptions (onSnapshot) bypass this cache
//  because Firestore SDK already manages their local state.
//
//  Cache storage: sessionStorage (cleared on tab close).
//  Falls back gracefully if sessionStorage is unavailable.
// ============================================================

const DEFAULT_TTL = 2 * 60 * 1000; // 2 minutes

// ── Storage adapter (sessionStorage with in-memory fallback) ──
const _mem = new Map();

const store = {
  get(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const { ts, ttl, data } = JSON.parse(raw);
      if (Date.now() - ts > ttl) { sessionStorage.removeItem(key); return null; }
      return data;
    } catch {
      // sessionStorage unavailable — use in-memory map
      const entry = _mem.get(key);
      if (!entry) return null;
      if (Date.now() - entry.ts > entry.ttl) { _mem.delete(key); return null; }
      return entry.data;
    }
  },

  set(key, data, ttl = DEFAULT_TTL) {
    try {
      sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), ttl, data }));
    } catch {
      _mem.set(key, { ts: Date.now(), ttl, data });
    }
  },

  delete(key) {
    try { sessionStorage.removeItem(key); } catch { /* ok */ }
    _mem.delete(key);
  },

  deleteByPrefix(prefix) {
    // sessionStorage
    try {
      Object.keys(sessionStorage)
        .filter(k => k.startsWith(prefix))
        .forEach(k => sessionStorage.removeItem(k));
    } catch { /* ok */ }
    // in-memory
    for (const k of _mem.keys()) {
      if (k.startsWith(prefix)) _mem.delete(k);
    }
  },

  clear() {
    try { sessionStorage.clear(); } catch { /* ok */ }
    _mem.clear();
  }
};

// ── Public API ────────────────────────────────────────────────

/**
 * Get a cached value, or compute it via loader() and cache the result.
 * @template T
 * @param {string}   key    - unique cache key
 * @param {function(): Promise<T>} loader - async function that fetches the data
 * @param {number}   [ttl]  - cache lifetime in ms (default 2 min)
 * @returns {Promise<T>}
 */
export async function getOrFetch(key, loader, ttl = DEFAULT_TTL) {
  const cached = store.get(key);
  if (cached !== null) return cached;

  const data = await loader();
  if (data !== null && data !== undefined) store.set(key, data, ttl);
  return data;
}

/**
 * Explicitly set a value in the cache.
 * Useful for write-through caching after a successful write.
 * @param {string} key
 * @param {*}      data
 * @param {number} [ttl]
 */
export function cacheSet(key, data, ttl = DEFAULT_TTL) {
  store.set(key, data, ttl);
}

/**
 * Invalidate a single cache entry.
 * Call after updating or deleting a listing.
 * @param {string} key
 */
export function cacheInvalidate(key) {
  store.delete(key);
}

/**
 * Invalidate all cache entries whose key starts with prefix.
 * @param {string} prefix - e.g. "listing:" or "page:"
 */
export function cacheInvalidatePrefix(prefix) {
  store.deleteByPrefix(prefix);
}

/**
 * Clear the entire service cache.
 * Called on logout to prevent cross-user data leakage.
 */
export function cacheClearAll() {
  store.clear();
}

// ── Predefined cache keys ─────────────────────────────────────
// Centralised here so every module uses the same key strings.
export const CacheKey = {
  listing:       (id)              => `listing:${id}`,
  page:          (cat, pageIndex)  => `page:${cat}:${pageIndex}`,
  vendorListings:(vendorId)        => `vendor:${vendorId}`,
  featured:                           "featured:listings",
};
