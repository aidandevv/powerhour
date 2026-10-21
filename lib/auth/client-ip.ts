const UNKNOWN_CLIENT = "unknown";
const MAX_TRUSTED_PROXY_HOPS = 10;

function cleanAddress(value: string): string {
  const trimmed = value.trim();
  const bracketedIpv6 = trimmed.match(/^\[([0-9a-fA-F:]+)\](?::\d+)?$/);
  if (bracketedIpv6) return bracketedIpv6[1];

  if (/^(?:\d{1,3}\.){3}\d{1,3}:\d+$/.test(trimmed)) {
    return trimmed.replace(/:\d+$/, "");
  }

  return trimmed;
}

function isPlausibleIp(value: string): boolean {
  if (!value || value.length > 45) return false;

  const ipv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value);
  if (ipv4) {
    return value.split(".").every((part) => Number(part) >= 0 && Number(part) <= 255);
  }

  return /^[0-9a-fA-F:]+$/.test(value) && value.includes(":");
}

/**
 * Number of reverse proxies in front of the app that append to
 * X-Forwarded-For. Defaults to 0 (direct exposure), in which case forwarding
 * headers are client-controlled and never trusted.
 */
export function getTrustedProxyHops(
  env: Record<string, string | undefined> = process.env
): number {
  const raw = env.TRUSTED_PROXY_HOPS?.trim();
  if (!raw || !/^\d+$/.test(raw)) return 0;

  const hops = Number(raw);
  return hops <= MAX_TRUSTED_PROXY_HOPS ? hops : 0;
}

/**
 * Returns the client address as seen by the outermost trusted proxy: the
 * X-Forwarded-For entry `hops` positions from the right. Entries further left
 * were supplied by the caller and are ignored. Any request that cannot be
 * attributed (no trusted proxies, a chain shorter than the configured hop
 * count, or a malformed entry at the trusted position) shares one bucket.
 */
export function getTrustedClientIp(
  headers: Headers,
  hops: number = getTrustedProxyHops()
): string {
  if (!Number.isInteger(hops) || hops < 1) return UNKNOWN_CLIENT;

  const forwardedFor = headers.get("x-forwarded-for");
  if (!forwardedFor) return UNKNOWN_CLIENT;

  const chain = forwardedFor.split(",");
  if (chain.length < hops) return UNKNOWN_CLIENT;

  const candidate = cleanAddress(chain[chain.length - hops]);
  return isPlausibleIp(candidate) ? candidate : UNKNOWN_CLIENT;
}
