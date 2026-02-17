import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and, gte, lte, ilike, sql, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, accounts, recurringItems, expenseGroupMembers, expenseGroups } from "@/lib/db/schema";
import { apiError } from "@/lib/api/error";

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
    const groupId = searchParams.get("group_id");

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

    if (groupId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(groupId)) {
      conditions.push(
        sql`${transactions.id} IN (
          SELECT transaction_id FROM expense_group_members
          WHERE group_id = ${groupId}::uuid
        )`
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

    const transactionIds = result.map((r) => r.id);
    const groupsByTxn: Record<string, { id: string; name: string }[]> = {};
    if (transactionIds.length > 0) {
      const memberships = await db
        .select({
          transactionId: expenseGroupMembers.transactionId,
          groupId: expenseGroups.id,
          groupName: expenseGroups.name,
        })
        .from(expenseGroupMembers)
        .innerJoin(expenseGroups, eq(expenseGroupMembers.groupId, expenseGroups.id))
        .where(inArray(expenseGroupMembers.transactionId, transactionIds));

      for (const m of memberships) {
        if (!groupsByTxn[m.transactionId]) groupsByTxn[m.transactionId] = [];
        groupsByTxn[m.transactionId].push({
          id: m.groupId,
          name: m.groupName,
        });
      }
    }

    const data = result.map((r) => ({
      ...r,
      groups: groupsByTxn[r.id] ?? [],
    }));

    return NextResponse.json({
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    return apiError(error, "Failed to fetch transactions");
  }
}
