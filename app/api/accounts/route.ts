import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, institutions } from "@/lib/db/schema";
import { decryptField } from "@/lib/crypto-fields";
import { apiError } from "@/lib/api/error";

export async function GET() {
  try {
    const result = await db
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
        institutionStatus: institutions.status,
      })
      .from(accounts)
      .innerJoin(institutions, eq(accounts.institutionId, institutions.id))
      .where(eq(accounts.isActive, true));

    // Group by institution
    const grouped: Record<
      string,
      { institutionId: string; institutionName: string; status: string; accounts: typeof result }
    > = {};

    for (const row of result) {
      const key = row.institutionId;
      if (!grouped[key]) {
        grouped[key] = {
          institutionId: row.institutionId,
          institutionName: row.institutionName,
          status: row.institutionStatus,
          accounts: [],
        };
      }
      grouped[key].accounts.push({
        ...row,
        name: decryptField(row.name) ?? row.name,
        officialName: decryptField(row.officialName),
      });
    }

    return NextResponse.json({ institutions: Object.values(grouped) });
  } catch (error: unknown) {
    return apiError(error, "Failed to fetch accounts");
  }
}
