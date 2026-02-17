import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { institutions } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { createRelinkToken } from "@/lib/plaid/link";
import { apiError } from "@/lib/api/error";
import { isDemoMode } from "@/lib/demo";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (isDemoMode()) {
    return NextResponse.json(
      { error: "Plaid is disabled in demo mode." },
      { status: 403 }
    );
  }

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
    return apiError(error, "Failed to create relink token");
  }
}
