/**
 * Tiny in-memory failure-counter rate limiter for auth-style endpoints
 * (login, quote PIN). Usage:
 *   if (isRateLimited(key)) return tooMany;
 *   ...attempt...
 *   on failure: recordFailure(key)
 *   on success: clearAttempts(key)
 *
 * ponytail: per-process only — counters reset on restart and are NOT shared
 * across instances. Fine for a single self-hosted node; swap the Map for Redis
 * (or a Postgres table) if the app is ever scaled horizontally.
 */

type Entry = { fails: number[]; lockedUntil: number };

const store = new Map<string, Entry>();
const MAX_KEYS = 10_000; // backstop against unbounded growth from junk keys

export type RateOpts = {
  /** failures allowed within the window before locking */
  max?: number;
  /** sliding window in ms */
  windowMs?: number;
  /** how long to lock once max is exceeded */
  lockMs?: number;
};

const DEFAULTS = { max: 5, windowMs: 15 * 60 * 1000, lockMs: 15 * 60 * 1000 };

function prune(now: number): void {
  if (store.size < MAX_KEYS) return;
  for (const [k, e] of store) {
    if (e.lockedUntil < now && e.fails.every((t) => now - t > DEFAULTS.windowMs)) {
      store.delete(k);
    }
  }
}

/** True if this key is currently locked out. Does not record anything. */
export function isRateLimited(key: string, opts: RateOpts = {}): { limited: boolean; retryAfterSec: number } {
  const { max, windowMs } = { ...DEFAULTS, ...opts };
  const now = Date.now();
  const e = store.get(key);
  if (!e) return { limited: false, retryAfterSec: 0 };
  if (e.lockedUntil > now) return { limited: true, retryAfterSec: Math.ceil((e.lockedUntil - now) / 1000) };
  const recent = e.fails.filter((t) => now - t < windowMs);
  if (recent.length >= max) return { limited: true, retryAfterSec: Math.ceil(windowMs / 1000) };
  return { limited: false, retryAfterSec: 0 };
}

/** Record one failed attempt; locks the key once `max` failures hit inside the window. */
export function recordFailure(key: string, opts: RateOpts = {}): void {
  const { max, windowMs, lockMs } = { ...DEFAULTS, ...opts };
  const now = Date.now();
  prune(now);
  const e = store.get(key) ?? { fails: [], lockedUntil: 0 };
  e.fails = e.fails.filter((t) => now - t < windowMs);
  e.fails.push(now);
  if (e.fails.length >= max) e.lockedUntil = now + lockMs;
  store.set(key, e);
}

/** Clear a key after a successful attempt. */
export function clearAttempts(key: string): void {
  store.delete(key);
}
