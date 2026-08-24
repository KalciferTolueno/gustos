const globalForRateLimit = globalThis as unknown as {
  authAttempts?: Map<string, { count: number; resetAt: number }>;
};

const attempts = globalForRateLimit.authAttempts ?? new Map();
if (process.env.NODE_ENV !== "production") globalForRateLimit.authAttempts = attempts;

// ponytail: process-local limiter is enough for one EasyPanel replica; move to PostgreSQL if auth is scaled horizontally.
export function allowAuthAttempt(key: string, limit = 10, windowMs = 15 * 60_000) {
  const now = Date.now();
  if (attempts.size > 10_000) {
    for (const [storedKey, value] of attempts) if (value.resetAt <= now) attempts.delete(storedKey);
  }
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function requestIp(request: Request) {
  return request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}

export function requesterHash(request: Request) {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "local-development-only").update(requestIp(request)).digest("hex");
}
import { createHmac } from "node:crypto";
