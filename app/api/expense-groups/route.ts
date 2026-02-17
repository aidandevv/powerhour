import { NextRequest, NextResponse } from "next/server";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { expenseGroups, expenseGroupMembers, transactions } from "@/lib/db/schema";
import { apiError } from "@/lib/api/error";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  budgetPlanId: z.string().uuid().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const budgetPlanId = searchParams.get("budgetPlanId") ?? undefined;

    const baseSelect = db
      .select({
        id: expenseGroups.id,
        name: expenseGroups.name,
        description: expenseGroups.description,
        budgetPlanId: expenseGroups.budgetPlanId,
        dateFrom: expenseGroups.dateFrom,
        dateTo: expenseGroups.dateTo,
        createdAt: expenseGroups.createdAt,
      })
      .from(expenseGroups)
      .orderBy(desc(expenseGroups.createdAt));

    const groups = budgetPlanId
      ? await baseSelect.where(eq(expenseGroups.budgetPlanId, budgetPlanId))
      : await baseSelect;

    const groupsWithStats = await Promise.all(
      groups.map(async (g) => {
        const [stats] = await db
          .select({
            memberCount: sql<number>`count(*)::int`,
            totalAmount: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
          })
          .from(expenseGroupMembers)
          .innerJoin(transactions, eq(expenseGroupMembers.transactionId, transactions.id))
          .where(eq(expenseGroupMembers.groupId, g.id));
        return {
          ...g,
          memberCount: stats?.memberCount ?? 0,
          totalAmount: parseFloat(stats?.totalAmount ?? "0"),
        };
      })
    );

    return NextResponse.json({ groups: groupsWithStats });
  } catch (error: unknown) {
    return apiError(error, "Failed to fetch expense groups");
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(expenseGroups)
      .values({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        budgetPlanId: parsed.data.budgetPlanId ?? null,
        dateFrom: parsed.data.dateFrom ?? null,
        dateTo: parsed.data.dateTo ?? null,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    return apiError(error, "Failed to create expense group");
  }
}
