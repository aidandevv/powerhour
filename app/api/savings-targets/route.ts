import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { savingsTargets } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { apiError } from "@/lib/api/error";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  targetAmount: z.number().positive(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  budgetPlanId: z.string().uuid().optional(),
});

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(savingsTargets)
      .orderBy(desc(savingsTargets.createdAt));

    return NextResponse.json(rows);
  } catch (error: unknown) {
    return apiError(error, "Failed to fetch savings targets");
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, targetAmount, targetDate, budgetPlanId } = parsed.data;

    const target = new Date(targetDate);
    const now = new Date();
    const months = Math.max(
      1,
      (target.getFullYear() - now.getFullYear()) * 12 +
        (target.getMonth() - now.getMonth())
    );
    const monthlyAmount = targetAmount / months;

    const [created] = await db
      .insert(savingsTargets)
      .values({
        name,
        targetAmount: String(targetAmount),
        targetDate,
        monthlyAmount: String(monthlyAmount.toFixed(2)),
        budgetPlanId: budgetPlanId ?? null,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    return apiError(error, "Failed to create savings target");
  }
}
