import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and, gte, lte, ilike, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, accounts, recurringItems } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const accountId = searchParams.get("account_id");
    const category = searchParams.get("category");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const search = searchParams.get("search");

    const conditions = [];

    if (accountId) {
      conditions.push(eq(transactions.accountId, accountId));
    }
    if (category) {
      conditions.push(eq(transactions.category, category));
    }
    if (from) {
      conditions.push(gte(transactions.date, from));
    }
    if (to) {
      conditions.push(lte(transactions.date, to));
    }
    if (search) {
      conditions.push(
        sql`(${ilike(transactions.name, `%${search}%`)} OR ${ilike(
          transactions.merchantName,
          `%${search}%`
        )})`
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(where);

    const total = countResult?.count || 0;
    const offset = (page - 1) * limit;

    const result = await db
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
        amount: transactions.amount,
        currencyCode: transactions.currencyCode,
        date: transactions.date,
        name: transactions.name,
        merchantName: transactions.merchantName,
        category: transactions.category,
        categoryDetailed: transactions.categoryDetailed,
        pending: transactions.pending,
        paymentChannel: transactions.paymentChannel,
        logoUrl: transactions.logoUrl,
        accountName: accounts.name,
        isRecurring: sql<boolean>`EXISTS (
          SELECT 1 FROM recurring_items
          WHERE recurring_items.account_id = ${transactions.accountId}
          AND recurring_items.is_active = true
          AND (
            recurring_items.merchant_name = ${transactions.merchantName}
            OR recurring_items.name = ${transactions.name}
          )
        )`,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(where)
      .orderBy(desc(transactions.date))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      data: result,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch transactions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
