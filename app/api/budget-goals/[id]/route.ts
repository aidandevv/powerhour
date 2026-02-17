import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { budgetGoals } from "@/lib/db/schema";

export const runtime = "nodejs";

const patchSchema = z.object({
  status: z.enum(["accepted", "dismissed"]).optional(),
  monthlyTarget: z.number().positive().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status;
  }
  if (parsed.data.monthlyTarget !== undefined) {
    updates.monthlyTarget = String(parsed.data.monthlyTarget);
  }

  const [updated] = await db
    .update(budgetGoals)
    .set(updates)
    .where(eq(budgetGoals.id, params.id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  return NextResponse.json({ goal: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const [updated] = await db
    .update(budgetGoals)
    .set({ status: "dismissed", updatedAt: new Date() })
    .where(eq(budgetGoals.id, params.id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
