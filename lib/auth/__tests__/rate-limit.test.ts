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

  it("allows 50 unreleased attempts across all clients, then blocks", async () => {
    for (let i = 0; i < 50; i++) {
      expect(await rateLimit.reserveGlobalLoginAttempt()).toEqual({ allowed: true });
    }

    const blocked = await rateLimit.reserveGlobalLoginAttempt();
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(15 * 60);
  });

  it("caps concurrent attempts at the ceiling", async () => {
    const results = await Promise.all(
      Array.from({ length: 80 }, () => rateLimit.reserveGlobalLoginAttempt())
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(50);
  });

  it("refunds attempts released after a successful login", async () => {
    for (let i = 0; i < 60; i++) {
      expect((await rateLimit.reserveGlobalLoginAttempt()).allowed).toBe(true);
      await rateLimit.releaseGlobalLoginAttempt();
    }
  });

  it("is independent of the per-client limiter", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await rateLimit.checkLoginRateLimit("unknown")).allowed).toBe(true);
    }
    expect((await rateLimit.checkLoginRateLimit("unknown")).allowed).toBe(false);
    expect(await rateLimit.reserveGlobalLoginAttempt()).toEqual({ allowed: true });
  });
});
