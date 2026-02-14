import { plaidClient } from "./client";
import { db } from "@/lib/db";
import { institutions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { syncInstitution } from "./sync";
import { detectAllRecurring } from "@/lib/recurring";
import crypto from "crypto";

export async function verifyPlaidWebhook(
  body: string,
  headers: Record<string, string>
): Promise<boolean> {
  const signedJwt = headers["plaid-verification"];
  if (!signedJwt) return false;

  try {
    // Get the webhook verification key from Plaid
    const keyId = JSON.parse(
      Buffer.from(signedJwt.split(".")[0], "base64url").toString()
    ).kid;

    const response = await plaidClient.webhookVerificationKeyGet({
      key_id: keyId,
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

    const [headerB64, payloadB64, signatureB64] = signedJwt.split(".");
    const data = `${headerB64}.${payloadB64}`;
    const signature = Buffer.from(signatureB64, "base64url");

    const isValid = crypto.verify(
      "SHA256",
      Buffer.from(data),
      publicKey,
      signature
    );

    if (!isValid) return false;

    // Verify the request body hash matches
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString()
    );
    const bodyHash = crypto
      .createHash("sha256")
      .update(body)
      .digest("base64url");

    return payload.request_body_sha256 === bodyHash;
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
