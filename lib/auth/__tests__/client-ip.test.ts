import { afterEach, describe, expect, it, vi } from "vitest";
import { getTrustedClientIp, getTrustedProxyHops } from "../client-ip";

function xff(value: string, extra: Record<string, string> = {}): Headers {
  return new Headers({ "x-forwarded-for": value, ...extra });
}

describe("getTrustedProxyHops", () => {
  it("defaults to 0 when unset or blank", () => {
    expect(getTrustedProxyHops({})).toBe(0);
    expect(getTrustedProxyHops({ TRUSTED_PROXY_HOPS: "  " })).toBe(0);
  });

  it("parses non-negative integers", () => {
    expect(getTrustedProxyHops({ TRUSTED_PROXY_HOPS: "0" })).toBe(0);
    expect(getTrustedProxyHops({ TRUSTED_PROXY_HOPS: "1" })).toBe(1);
    expect(getTrustedProxyHops({ TRUSTED_PROXY_HOPS: " 2 " })).toBe(2);
  });

  it("fails closed to 0 on invalid or out-of-range values", () => {
    for (const value of ["-1", "1.5", "one", "1e2", "0x1", "11", "999"]) {
      expect(getTrustedProxyHops({ TRUSTED_PROXY_HOPS: value })).toBe(0);
    }
  });
});

describe("getTrustedClientIp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("with no trusted proxies (0 hops)", () => {
    it("ignores client-supplied X-Forwarded-For and X-Real-IP", () => {
      const headers = xff("203.0.113.77, 198.51.100.10", { "x-real-ip": "198.51.100.20" });
      expect(getTrustedClientIp(headers, 0)).toBe("unknown");
    });

    it("maps every spoofed address to the same rate-limit key", () => {
      const keys = new Set(
        ["203.0.113.1", "203.0.113.2", "2001:db8::1", "198.51.100.1, 198.51.100.2"].map(
          (value) => getTrustedClientIp(xff(value), 0)
        )
      );
      expect([...keys]).toEqual(["unknown"]);
    });

    it("is the default when TRUSTED_PROXY_HOPS is unset", () => {
      vi.stubEnv("TRUSTED_PROXY_HOPS", "");
      expect(getTrustedClientIp(xff("203.0.113.77"))).toBe("unknown");
    });

    it("rejects non-integer and negative hop counts", () => {
      expect(getTrustedClientIp(xff("203.0.113.77"), -1)).toBe("unknown");
      expect(getTrustedClientIp(xff("203.0.113.77"), 1.5)).toBe("unknown");
    });
  });

  describe("with one trusted proxy", () => {
    it("selects the rightmost entry", () => {
      expect(getTrustedClientIp(xff("203.0.113.77"), 1)).toBe("203.0.113.77");
      expect(getTrustedClientIp(xff("10.9.9.9, 203.0.113.77"), 1)).toBe("203.0.113.77");
    });

    it("reads the hop count from TRUSTED_PROXY_HOPS", () => {
      vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
      expect(getTrustedClientIp(xff("10.9.9.9, 203.0.113.77"))).toBe("203.0.113.77");
    });

    it("does not let caller-prepended entries change the key", () => {
      const a = getTrustedClientIp(xff("1.1.1.1, 203.0.113.77"), 1);
      const b = getTrustedClientIp(xff("2.2.2.2, 3.3.3.3, 203.0.113.77"), 1);
      expect(a).toBe("203.0.113.77");
      expect(b).toBe(a);
    });

    it("does not fall back to X-Real-IP", () => {
      expect(getTrustedClientIp(new Headers({ "x-real-ip": "198.51.100.20" }), 1)).toBe(
        "unknown"
      );
    });
  });

  describe("with two trusted proxies", () => {
    it("selects the entry two hops from the right", () => {
      expect(getTrustedClientIp(xff("203.0.113.77, 10.0.0.2"), 2)).toBe("203.0.113.77");
    });

    it("ignores caller-supplied entries left of the trusted hop", () => {
      expect(getTrustedClientIp(xff("6.6.6.6, 7.7.7.7, 203.0.113.77, 10.0.0.2"), 2)).toBe(
        "203.0.113.77"
      );
    });
  });

  describe("short or malformed chains", () => {
    it("returns unknown when the chain is shorter than the hop count", () => {
      expect(getTrustedClientIp(xff("203.0.113.77"), 2)).toBe("unknown");
    });

    it("returns unknown when the header is missing or empty", () => {
      expect(getTrustedClientIp(new Headers(), 1)).toBe("unknown");
      expect(getTrustedClientIp(xff(""), 1)).toBe("unknown");
    });

    it("returns unknown instead of skipping a malformed entry at the trusted hop", () => {
      expect(getTrustedClientIp(xff("203.0.113.77, not-an-ip"), 1)).toBe("unknown");
      expect(getTrustedClientIp(xff("203.0.113.77, "), 1)).toBe("unknown");
      expect(getTrustedClientIp(xff("203.0.113.77, , 10.0.0.2"), 2)).toBe("unknown");
      expect(getTrustedClientIp(xff("999.1.1.1"), 1)).toBe("unknown");
      expect(getTrustedClientIp(xff("a".repeat(46) + ":"), 1)).toBe("unknown");
    });

    it("strips ports and IPv6 brackets", () => {
      expect(getTrustedClientIp(xff("[2001:db8::1]:443"), 1)).toBe("2001:db8::1");
      expect(getTrustedClientIp(xff("203.0.113.77:51234"), 1)).toBe("203.0.113.77");
      expect(getTrustedClientIp(xff(" 2001:db8::2 "), 1)).toBe("2001:db8::2");
    });
  });
});
