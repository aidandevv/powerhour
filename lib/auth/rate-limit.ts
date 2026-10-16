import { RateLimiterMemory } from "rate-limiter-flexible";

const loginRateLimiter = new RateLimiterMemory({
  points: 5, // 5 attempts
  duration: 15 * 60, // per 15 minutes
  blockDuration: 15 * 60, // block for 15 minutes
});

// Shared across all clients so attempts that collapse into one bucket (or
// rotate spoofed addresses) still have a hard ceiling on password guesses.
const GLOBAL_LOGIN_FAILURE_POINTS = 50;
const GLOBAL_LOGIN_KEY = "global";
const globalLoginFailureLimiter = new RateLimiterMemory({
  keyPrefix: "login-failures-global",
  points: GLOBAL_LOGIN_FAILURE_POINTS, // 50 failed attempts
  duration: 15 * 60, // per 15 minutes, across all clients
});

export const syncRateLimiter = new RateLimiterMemory({
  points: 3, // 3 syncs
  duration: 15 * 60, // per 15 minutes
  blockDuration: 15 * 60,
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

/**
 * Reserves one global failure point before the password is checked, so
 * concurrent requests cannot all pass the ceiling check while bcrypt runs.
 * Call releaseGlobalLoginAttempt() after a successful login to refund it.
 */
export async function reserveGlobalLoginAttempt(): Promise<{
  allowed: boolean;
  retryAfterSeconds?: number;
}> {
  try {
    await globalLoginFailureLimiter.consume(GLOBAL_LOGIN_KEY);
    return { allowed: true };
  } catch (rejRes: unknown) {
    const rej = rejRes as { msBeforeNext?: number };
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((rej.msBeforeNext ?? 0) / 1000),
    };
  }
}

export async function releaseGlobalLoginAttempt(): Promise<void> {
  await globalLoginFailureLimiter.reward(GLOBAL_LOGIN_KEY, 1);
}
