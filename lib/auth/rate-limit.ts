import { RateLimiterMemory } from "rate-limiter-flexible";

const loginRateLimiter = new RateLimiterMemory({
  points: 5, // 5 attempts
  duration: 15 * 60, // per 15 minutes
  blockDuration: 15 * 60, // block for 15 minutes
});

export async function checkLoginRateLimit(ip: string): Promise<{
  allowed: boolean;
  retryAfterSeconds?: number;
  remainingAttempts?: number;
}> {
  try {
    const result = await loginRateLimiter.consume(ip);
    return {
      allowed: true,
      remainingAttempts: result.remainingPoints,
    };
  } catch (rejRes: unknown) {
    const rej = rejRes as { msBeforeNext?: number };
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((rej.msBeforeNext ?? 0) / 1000),
    };
  }
}
