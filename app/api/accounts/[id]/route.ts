import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, institutions } from "@/lib/db/schema";
import { decryptField } from "@/lib/crypto-fields";
import { apiError } from "@/lib/api/error";

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

    return NextResponse.json({
      ...account,
      name: decryptField(account.name) ?? account.name,
      officialName: decryptField(account.officialName),
    });
  } catch (error: unknown) {
    return apiError(error, "Failed to fetch account");
  }
}
