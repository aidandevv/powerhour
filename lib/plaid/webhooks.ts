import { plaidClient } from "./client";
import { db } from "@/lib/db";
import { institutions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { syncInstitution } from "./sync";
import { detectAllRecurring } from "@/lib/recurring";
import crypto from "crypto";

const PLAID_WEBHOOK_ALGORITHM = "ES256";
const PLAID_WEBHOOK_MAX_AGE_MS = 5 * 60 * 1000;

function timingSafeEqualString(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export async function verifyPlaidWebhook(
  body: string,
  headers: Record<string, string>
): Promise<boolean> {
  const signedJwt = headers["plaid-verification"];
  if (!signedJwt) return false;

  try {
    const tokenParts = signedJwt.split(".");
    if (tokenParts.length !== 3) return false;

    const [headerB64, payloadB64, signatureB64] = tokenParts;
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
    if (header.alg !== PLAID_WEBHOOK_ALGORITHM || typeof header.kid !== "string") {
      return false;
    }

    // Get the webhook verification key from Plaid
    const response = await plaidClient.webhookVerificationKeyGet({
      key_id: header.kid,
    });

    const key = response.data.key;

    // Verify using the JWK
    const publicKey = crypto.createPublicKey({
      key: {
        kty: key.kty,
        crv: key.crv,
        x: key.x,
        y: key.y,
      },
      format: "jwk",
    });

    const data = `${headerB64}.${payloadB64}`;
    const signature = Buffer.from(signatureB64, "base64url");

    const isValid = crypto.verify(
      "SHA256",
      Buffer.from(data),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      signature
    );

    if (!isValid) return false;

    // Verify the request body hash matches
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString()
    );

    if (typeof payload.iat !== "number") return false;
    const issuedAtMs = payload.iat * 1000;
    const now = Date.now();
    if (issuedAtMs > now || now - issuedAtMs > PLAID_WEBHOOK_MAX_AGE_MS) {
      return false;
    }

    const bodyHash = crypto
      .createHash("sha256")
      .update(body)
      .digest("base64url");

    return (
      typeof payload.request_body_sha256 === "string" &&
      timingSafeEqualString(payload.request_body_sha256, bodyHash)
    );
  } catch {
    return false;
  }
}

export async function handleWebhook(webhookBody: {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  [key: string]: unknown;
}) {
  const { webhook_type, webhook_code, item_id } = webhookBody;

  // Find the institution by Plaid item_id
  const [institution] = await db
    .select()
    .from(institutions)
    .where(eq(institutions.plaidItemId, item_id));

  if (!institution) {
    console.error(`Webhook received for unknown item_id: ${item_id}`);
    return;
  }

  switch (webhook_type) {
    case "TRANSACTIONS": {
      if (
        webhook_code === "SYNC_UPDATES_AVAILABLE" ||
        webhook_code === "DEFAULT_UPDATE"
      ) {
        await syncInstitution(institution.id);
        await detectAllRecurring();
      }
      break;
    }

    case "ITEM": {
      if (webhook_code === "ERROR") {
        await db
          .update(institutions)
          .set({
            status: "error",
            errorCode: (webhookBody.error as { error_code?: string })?.error_code || "UNKNOWN",
            updatedAt: new Date(),
          })
          .where(eq(institutions.id, institution.id));
      } else if (webhook_code === "PENDING_EXPIRATION") {
        await db
          .update(institutions)
          .set({
            status: "relink_required",
            updatedAt: new Date(),
          })
          .where(eq(institutions.id, institution.id));
      }
      break;
    }
  }
}
