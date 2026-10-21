const UNKNOWN_CLIENT = "unknown";

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
  const cleaned = cleanAddress(value);
  if (!cleaned || cleaned.length > 45) return false;

  const ipv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(cleaned);
  if (ipv4) {
    return cleaned.split(".").every((part) => Number(part) >= 0 && Number(part) <= 255);
  }

  return /^[0-9a-fA-F:]+$/.test(cleaned) && cleaned.includes(":");
}

function firstValidIpFromRight(headerValue: string | null): string | null {
  if (!headerValue) return null;

  const forwardedChain = headerValue
    .split(",")
    .map(cleanAddress)
    .filter(Boolean);

  for (let i = forwardedChain.length - 1; i >= 0; i--) {
    if (isPlausibleIp(forwardedChain[i])) {
      return forwardedChain[i];
    }
  }

  return null;
}

export function getTrustedClientIp(headers: Headers): string {
  return (
    firstValidIpFromRight(headers.get("x-forwarded-for")) ??
    firstValidIpFromRight(headers.get("x-real-ip")) ??
    UNKNOWN_CLIENT
  );
}
