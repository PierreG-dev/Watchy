/**
 * In-memory rate limiter for login attempts.
 * Suitable for the single-instance auto-hosted deployment we target.
 */

interface Bucket {
  count: number;
  firstAttempt: number;
  lockedUntil: number;
}

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

export function checkLoginRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(ip);

  if (b && b.lockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((b.lockedUntil - now) / 1000), remaining: 0 };
  }
  if (b && now - b.firstAttempt > WINDOW_MS) {
    buckets.delete(ip);
    return { allowed: true, retryAfterSeconds: 0, remaining: MAX_ATTEMPTS - 1 };
  }
  const remaining = b ? Math.max(0, MAX_ATTEMPTS - b.count) : MAX_ATTEMPTS;
  return { allowed: remaining > 0, retryAfterSeconds: 0, remaining };
}

export function recordFailedLogin(ip: string): void {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now - b.firstAttempt > WINDOW_MS) {
    buckets.set(ip, { count: 1, firstAttempt: now, lockedUntil: 0 });
    return;
  }
  b.count += 1;
  if (b.count >= MAX_ATTEMPTS) {
    b.lockedUntil = now + LOCKOUT_MS;
  }
}

export function recordSuccessfulLogin(ip: string): void {
  buckets.delete(ip);
}

// Periodic cleanup so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of buckets) {
    if (b.lockedUntil <= now && now - b.firstAttempt > WINDOW_MS) {
      buckets.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref?.();
