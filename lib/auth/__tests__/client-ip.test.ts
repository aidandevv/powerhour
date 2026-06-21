import { describe, expect, it } from "vitest";
import { getTrustedClientIp } from "../client-ip";

describe("getTrustedClientIp", () => {
  it("uses the trusted proxy side of a forwarded chain instead of caller-supplied first values", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.77, 198.51.100.10",
    });

    expect(getTrustedClientIp(headers)).toBe("198.51.100.10");
  });

  it("falls back to x-real-ip when x-forwarded-for is unavailable", () => {
    const headers = new Headers({
      "x-real-ip": "198.51.100.20",
    });

    expect(getTrustedClientIp(headers)).toBe("198.51.100.20");
  });

  it("collapses invalid or missing addresses into a shared unknown bucket", () => {
    const headers = new Headers({
      "x-forwarded-for": "not-an-ip",
      "x-real-ip": "also-not-an-ip",
    });

    expect(getTrustedClientIp(headers)).toBe("unknown");
    expect(getTrustedClientIp(new Headers())).toBe("unknown");
  });

  it("accepts bracketed IPv6 addresses", () => {
    const headers = new Headers({
      "x-forwarded-for": "[2001:db8::1]:443",
    });

    expect(getTrustedClientIp(headers)).toBe("2001:db8::1");
  });
});

