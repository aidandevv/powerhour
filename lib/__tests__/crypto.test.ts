import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decrypt, encrypt } from "../crypto";
import { decryptField, encryptField } from "../crypto-fields";

const TEST_ENCRYPTION_KEY = "a".repeat(64);

describe("field encryption", () => {
  beforeEach(() => {
    vi.stubEnv("ENCRYPTION_KEY", TEST_ENCRYPTION_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips sensitive values with a fresh IV for each encryption", () => {
    const plaintext = "access-sandbox-sensitive-token";
    const first = encrypt(plaintext);
    const second = encrypt(plaintext);

    expect(first).not.toBe(second);
    expect(first.split(":")).toHaveLength(3);
    expect(decrypt(first)).toBe(plaintext);
    expect(decrypt(second)).toBe(plaintext);
  });

  it("rejects altered ciphertext rather than returning unauthenticated data", () => {
    const [iv, ciphertext, authTag] = encrypt("bank-token").split(":");
    const alteredAuthTag = `${authTag.slice(0, -1)}${authTag.endsWith("0") ? "1" : "0"}`;

    expect(() => decrypt(`${iv}:${ciphertext}:${alteredAuthTag}`)).toThrow();
  });

  it("fails fast when the encryption key is missing or malformed", () => {
    vi.stubEnv("ENCRYPTION_KEY", "");
    expect(() => encrypt("value")).toThrow("ENCRYPTION_KEY environment variable is not set");

    vi.stubEnv("ENCRYPTION_KEY", "too-short");
    expect(() => encrypt("value")).toThrow("ENCRYPTION_KEY must be 64 hex characters");
  });

  it("preserves nulls and supports legacy plaintext while encrypting new fields", () => {
    expect(encryptField(null)).toBeNull();
    expect(decryptField(null)).toBeNull();

    const encrypted = encryptField("Plaid access token");
    expect(encrypted).not.toBe("Plaid access token");
    expect(decryptField(encrypted)).toBe("Plaid access token");
    expect(decryptField("legacy plaintext")).toBe("legacy plaintext");
  });
});
