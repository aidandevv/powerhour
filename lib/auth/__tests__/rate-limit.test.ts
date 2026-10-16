import { beforeEach, describe, expect, it, vi } from "vitest";

type RateLimitModule = typeof import("../rate-limit");

async function freshModule(): Promise<RateLimitModule> {
  vi.resetModules();
  return import("../rate-limit");
}

describe("global login failure limiter", () => {
  let rateLimit: RateLimitModule;

  beforeEach(async () => {
    rateLimit = await freshModule();
  });

  it("allows attempts until 50 failures are recorded across all clients", async () => {
    for (let i = 0; i < 49; i++) {
      await rateLimit.recordGlobalLoginFailure();
    }
    expect(await rateLimit.checkGlobalLoginFailureLimit()).toEqual({ allowed: true });

    await rateLimit.recordGlobalLoginFailure();
    const blocked = await rateLimit.checkGlobalLoginFailureLimit();
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(15 * 60);
  });

  it("tolerates failures recorded past the ceiling", async () => {
    for (let i = 0; i < 55; i++) {
      await rateLimit.recordGlobalLoginFailure();
    }
    expect((await rateLimit.checkGlobalLoginFailureLimit()).allowed).toBe(false);
  });

  it("is independent of the per-client limiter", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await rateLimit.checkLoginRateLimit("unknown")).allowed).toBe(true);
    }
    expect((await rateLimit.checkLoginRateLimit("unknown")).allowed).toBe(false);
    expect(await rateLimit.checkGlobalLoginFailureLimit()).toEqual({ allowed: true });
  });
});
