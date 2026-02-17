import { encrypt, decrypt } from "@/lib/crypto";

export function encryptField(value: string | null): string | null {
  if (value === null) return null;
  return encrypt(value);
}

export function decryptField(value: string | null): string | null {
  if (value === null) return null;
  try {
    return decrypt(value);
  } catch {
    // Value is not encrypted (e.g. migrating from plaintext) — return as-is
    return value;
  }
}
