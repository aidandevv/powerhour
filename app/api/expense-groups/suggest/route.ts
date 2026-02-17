import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte, ilike, or, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, accounts } from "@/lib/db/schema";
import { apiError } from "@/lib/api/error";
import { z } from "zod";

const suggestSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateFrom required (YYYY-MM-DD)"),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateTo required (YYYY-MM-DD)"),
  query: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = suggestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "dateFrom and dateTo required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const { dateFrom, dateTo, query, limit } = parsed.data;

    const conditions = [
      gte(transactions.date, dateFrom),
      lte(transactions.date, dateTo),
    ];

    if (query && query.trim()) {
      const q = `%${query.trim()}%`;
      conditions.push(
        or(
          ilike(transactions.name, q),
          ilike(transactions.merchantName, q),
          ilike(transactions.category ?? "", q)
        )!
      );
    }

    const rows = await db
      .select({
        id: transactions.id,
        date: transactions.date,
        name: transactions.name,
        merchantName: transactions.merchantName,
        amount: transactions.amount,
        category: transactions.category,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(and(...conditions))
      .orderBy(desc(transactions.date))
      .limit(limit);

    const suggestions = rows.map((r) => ({
      id: r.id,
      date: r.date,
      name: r.name,
      merchantName: r.merchantName ?? null,
      amount: parseFloat(String(r.amount)),
      category: r.category ?? null,
    }));

    return NextResponse.json({ suggestions });
  } catch (error: unknown) {
    return apiError(error, "Failed to suggest transactions");
  }
}
