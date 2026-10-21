import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyPlaidWebhook } from "../webhooks";

const { webhookVerificationKeyGetMock } = vi.hoisted(() => ({
  webhookVerificationKeyGetMock: vi.fn(),
}));

vi.mock("../client", () => ({
  plaidClient: {
    webhookVerificationKeyGet: webhookVerificationKeyGetMock,
  },
}));

vi.mock("@/lib/db", () => ({
  db: {},
}));

vi.mock("../sync", () => ({
  syncInstitution: vi.fn(),
}));

vi.mock("@/lib/recurring", () => ({
  detectAllRecurring: vi.fn(),
}));

function base64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signWebhookJwt({
  body,
  alg = "ES256",
  iat = Math.floor(Date.now() / 1000),
  keyId = "test-key",
  privateKey,
}: {
  body: string;
  alg?: string;
  iat?: number;
  keyId?: string;
  privateKey: crypto.KeyObject;
}) {
  const header = base64urlJson({ alg, kid: keyId });
  const payload = base64urlJson({
    iat,
    request_body_sha256: crypto.createHash("sha256").update(body).digest("base64url"),
  });
  const data = `${header}.${payload}`;
  const signature = crypto.sign("SHA256", Buffer.from(data), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });

  return `${data}.${signature.toString("base64url")}`;
}

describe("verifyPlaidWebhook", () => {
  let privateKey: crypto.KeyObject;

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();

    const keyPair = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
    privateKey = keyPair.privateKey;
    const jwk = keyPair.publicKey.export({ format: "jwk" });

    webhookVerificationKeyGetMock.mockResolvedValue({
      data: {
        key: {
          kty: jwk.kty,
          crv: jwk.crv,
          x: jwk.x,
          y: jwk.y,
        },
      },
    });
  });

  it("accepts a fresh ES256 webhook whose body hash matches", async () => {
    const body = JSON.stringify({ webhook_type: "TRANSACTIONS", item_id: "item-1" });
    const jwt = signWebhookJwt({ body, privateKey });

    await expect(verifyPlaidWebhook(body, { "plaid-verification": jwt })).resolves.toBe(true);
  });

  it("rejects stale signed webhooks", async () => {
    const body = JSON.stringify({ webhook_type: "TRANSACTIONS", item_id: "item-1" });
    const jwt = signWebhookJwt({
      body,
      privateKey,
      iat: Math.floor((Date.now() - 6 * 60 * 1000) / 1000),
    });

    await expect(verifyPlaidWebhook(body, { "plaid-verification": jwt })).resolves.toBe(false);
  });

  it("rejects unexpected JWT algorithms", async () => {
    const body = JSON.stringify({ webhook_type: "TRANSACTIONS", item_id: "item-1" });
    const jwt = signWebhookJwt({ body, privateKey, alg: "none" });

    await expect(verifyPlaidWebhook(body, { "plaid-verification": jwt })).resolves.toBe(false);
  });

  it("rejects matching signatures for modified request bodies", async () => {
    const body = JSON.stringify({ webhook_type: "TRANSACTIONS", item_id: "item-1" });
    const jwt = signWebhookJwt({ body, privateKey });

    await expect(
      verifyPlaidWebhook(JSON.stringify({ webhook_type: "ITEM", item_id: "item-1" }), {
        "plaid-verification": jwt,
      })
    ).resolves.toBe(false);
  });
});

