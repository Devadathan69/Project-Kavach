import "server-only";
import { createHash } from "crypto";

type LimitOptions = {
  limit: number;
  windowMs: number;
};

type LimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

const buckets = new Map<string, number[]>();
const MAX_BUCKETS = 10_000;

function prune(now: number, windowMs: number) {
  for (const [key, timestamps] of buckets) {
    const retained = timestamps.filter((timestamp) => timestamp > now - windowMs);
    if (retained.length === 0) buckets.delete(key);
    else buckets.set(key, retained);
  }
}

export function clientRequestKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown-client";
  return createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

export function applyRateLimit(scope: string, clientKey: string, options: LimitOptions): LimitResult {
  const now = Date.now();
  if (buckets.size > MAX_BUCKETS) prune(now, options.windowMs);

  const key = `${scope}:${clientKey}`;
  const timestamps = (buckets.get(key) ?? []).filter((timestamp) => timestamp > now - options.windowMs);
  if (timestamps.length >= options.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((timestamps[0] + options.windowMs - now) / 1000));
    buckets.set(key, timestamps);
    return { allowed: false, retryAfterSeconds };
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return { allowed: true, retryAfterSeconds: 0 };
}
