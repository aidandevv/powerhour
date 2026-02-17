import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { expenseGroups, expenseGroupMembers, transactions, accounts } from "@/lib/db/schema";
import { apiError } from "@/lib/api/error";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  budgetPlanId: z.string().uuid().optional().nullable(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [group] = await db
      .select()
      .from(expenseGroups)
      .where(eq(expenseGroups.id, params.id));

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const members = await db
      .select({
        id: expenseGroupMembers.id,
        transactionId: expenseGroupMembers.transactionId,
        date: transactions.date,
        name: transactions.name,
        merchantName: transactions.merchantName,
        amount: transactions.amount,
        category: transactions.category,
        accountName: accounts.name,
      })
      .from(expenseGroupMembers)
      .innerJoin(transactions, eq(expenseGroupMembers.transactionId, transactions.id))
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(eq(expenseGroupMembers.groupId, params.id));

    const totalAmount = members.reduce(
      (sum, m) => sum + parseFloat(String(m.amount)),
      0
    );

    return NextResponse.json({
      ...group,
      members: members.map((m) => ({
        id: m.id,
        transactionId: m.transactionId,
        date: m.date,
        name: m.name,
        merchantName: m.merchantName,
        amount: parseFloat(String(m.amount)),
        category: m.category,
        accountName: m.accountName,
      })),
      totalAmount,
    });
  } catch (error: unknown) {
    return apiError(error, "Failed to fetch expense group");
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.description !== undefined)
      updateData.description = parsed.data.description;
    if (parsed.data.budgetPlanId !== undefined)
      updateData.budgetPlanId = parsed.data.budgetPlanId;
    if (parsed.data.dateFrom !== undefined) updateData.dateFrom = parsed.data.dateFrom;
    if (parsed.data.dateTo !== undefined) updateData.dateTo = parsed.data.dateTo;
    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(expenseGroups)
      .set(updateData as Record<string, Date | string | null>)
      .where(eq(expenseGroups.id, params.id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
    return apiError(error, "Failed to update expense group");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [deleted] = await db
      .delete(expenseGroups)
      .where(eq(expenseGroups.id, params.id))
      .returning({ id: expenseGroups.id });

    if (!deleted) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return apiError(error, "Failed to delete expense group");
  }
}
