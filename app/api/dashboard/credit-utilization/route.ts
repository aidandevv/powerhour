import { NextResponse } from "next/server";
import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        currentBalance: accounts.currentBalance,
        creditLimit: accounts.creditLimit,
      })
      .from(accounts)
      .where(
        and(
          eq(accounts.isActive, true),
          eq(accounts.type, "credit"),
          isNotNull(accounts.creditLimit)
        )
      );

    const cards = rows
      .filter((r) => parseFloat(r.creditLimit ?? "0") > 0)
      .map((r) => {
        const balance = parseFloat(r.currentBalance ?? "0");
        const limit = parseFloat(r.creditLimit ?? "0");
        return {
          id: r.id,
          name: r.name,
          balance,
          limit,
          utilization: limit > 0 ? Math.round((balance / limit) * 100) : 0,
        };
      })
      .sort((a, b) => b.utilization - a.utilization);

    return NextResponse.json({ cards });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch credit utilization";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
