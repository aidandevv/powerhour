import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { institutions } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { plaidClient } from "@/lib/plaid/client";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const [institution] = await db
      .select()
      .from(institutions)
      .where(eq(institutions.id, id));

    if (!institution) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    // Revoke Plaid access token
    try {
      const accessToken = decrypt(institution.plaidAccessToken);
      await plaidClient.itemRemove({ access_token: accessToken });
    } catch {
      // Continue with deletion even if Plaid revocation fails
    }

    // Delete institution (cascades to accounts + transactions)
    await db.delete(institutions).where(eq(institutions.id, id));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete institution";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
