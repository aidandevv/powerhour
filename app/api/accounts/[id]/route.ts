import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, institutions } from "@/lib/db/schema";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [account] = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        officialName: accounts.officialName,
        type: accounts.type,
        subtype: accounts.subtype,
        currencyCode: accounts.currencyCode,
        currentBalance: accounts.currentBalance,
        availableBalance: accounts.availableBalance,
        creditLimit: accounts.creditLimit,
        isActive: accounts.isActive,
        institutionId: accounts.institutionId,
        institutionName: institutions.institutionName,
      })
      .from(accounts)
      .innerJoin(institutions, eq(accounts.institutionId, institutions.id))
      .where(eq(accounts.id, params.id));

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    return NextResponse.json(account);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
