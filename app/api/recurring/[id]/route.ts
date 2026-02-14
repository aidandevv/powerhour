import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { recurringItems } from "@/lib/db/schema";

const updateSchema = z.object({
  isActive: z.boolean().optional(),
  isUserConfirmed: z.boolean().optional(),
  name: z.string().optional(),
  amount: z.number().optional(),
  frequency: z.enum(["weekly", "biweekly", "monthly", "annually"]).optional(),
});

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

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
    if (parsed.data.isUserConfirmed !== undefined) updateData.isUserConfirmed = parsed.data.isUserConfirmed;
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.amount !== undefined) updateData.amount = parsed.data.amount.toFixed(2);
    if (parsed.data.frequency !== undefined) updateData.frequency = parsed.data.frequency;

    const [updated] = await db
      .update(recurringItems)
      .set(updateData)
      .where(eq(recurringItems.id, params.id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Recurring item not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update recurring item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
