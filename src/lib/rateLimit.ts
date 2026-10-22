interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const MAX_ENTRIES = 10000;
let cleanupCounter = 0;

function cleanup() {
  cleanupCounter++;
  if (cleanupCounter % 100 !== 0) return;
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

export function checkRateLimit(
  key: string,
  limit: { maxRequests: number; windowMs: number }
): { allowed: boolean; remaining: number; resetMs: number } {
  cleanup();
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || now > existing.resetAt) {
    const entry: RateLimitEntry = {
      count: 1,
      resetAt: now + limit.windowMs,
    };
    if (store.size < MAX_ENTRIES) {
      store.set(key, entry);
    }
    return { allowed: true, remaining: limit.maxRequests - 1, resetMs: limit.windowMs };
  }

  existing.count++;
  if (existing.count > limit.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: existing.resetAt - now,
    };
  }

  return {
    allowed: true,
    remaining: limit.maxRequests - existing.count,
    resetMs: existing.resetAt - now,
  };
}

export function getClientIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return first.trim();
  }
  const realIp = headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }
  return 'unknown';
}

export const PAYMENT_RATE_LIMIT = { maxRequests: 5, windowMs: 60_000 };
export const ANALYZE_RATE_LIMIT = { maxRequests: 10, windowMs: 60_000 };

// Limitador general por IP para endpoints caros (analyze, chat, borradores).
// Nota: en serverless (Vercel) este almacen en memoria es por instancia y se
// pierde en cada cold start: el limite es debil y defensivo. Se migra a la
// base de datos en la Fase 2.
const GENERAL_API_MAX = Number(process.env.GENERAL_API_RATE_LIMIT_MAX) || 30;
export const GENERAL_API_RATE_LIMIT = { maxRequests: GENERAL_API_MAX, windowMs: 3_600_000 };
