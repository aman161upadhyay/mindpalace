// In-memory sliding-window rate limiter.
// NOT persistent — resets when the Vercel function instance restarts.
// Suitable for abuse prevention; upgrade to Redis for strict enforcement.

const store = new Map<string, number[]>();

export interface RateLimitConfig {
  windowMs: number; // window size in milliseconds
  max: number;      // max requests allowed per window
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export function rateLimit(ip: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const timestamps = (store.get(ip) ?? []).filter((t) => t > windowStart);
  const allowed = timestamps.length < config.max;
  if (allowed) {
    timestamps.push(now);
  }
  if (timestamps.length > 0) {
    store.set(ip, timestamps);
  } else {
    store.delete(ip);
  }
  const remaining = Math.max(0, config.max - timestamps.length);
  return { allowed, remaining };
}

export function getClientIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() ?? "unknown";
  if (Array.isArray(forwarded)) return forwarded[0]?.trim() ?? "unknown";
  return "unknown";
}
