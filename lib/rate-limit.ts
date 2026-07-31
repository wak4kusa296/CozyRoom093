type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

const entries = new Map<string, RateLimitEntry>();
const MAX_ENTRIES = 10_000;

/** Returns a bounded client key suitable for best-effort in-memory rate limits. */
export function getRequestClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const candidate = forwarded.split(",", 1)[0]?.trim() ?? "";
  if (/^[a-fA-F0-9:.]{1,64}$/.test(candidate)) return candidate.toLowerCase();

  const realIp = request.headers.get("x-real-ip")?.trim() ?? "";
  if (/^[a-fA-F0-9:.]{1,64}$/.test(realIp)) return realIp.toLowerCase();
  return "unknown";
}

/**
 * Applies a fixed-window limit. This is process-local by design; use a shared
 * limiter before horizontally scaling the application.
 */
export function takeRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (entries.size >= MAX_ENTRIES) {
    for (const [entryKey, entry] of entries) {
      if (entry.resetAt <= now) entries.delete(entryKey);
    }
  }

  const current = entries.get(key);
  if (!current || current.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  current.count += 1;
  return {
    allowed: current.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
  };
}

export function rateLimitHeaders(retryAfterSeconds: number): HeadersInit {
  return { "Retry-After": String(retryAfterSeconds), "Cache-Control": "no-store" };
}
