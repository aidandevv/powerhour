import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { institutions } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { createRelinkToken } from "@/lib/plaid/link";

export async function POST(
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

    const accessToken = decrypt(institution.plaidAccessToken);
    const linkToken = await createRelinkToken(accessToken);

    return NextResponse.json({ link_token: linkToken });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create relink token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
