import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { budgetPlans } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { apiError } from "@/lib/api/error";

export const runtime = "nodejs";

const updatePlanSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  messagesJson: z.array(z.any()).optional(),
  summaryText: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const parsed = updatePlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (parsed.data.title != null) updates.title = parsed.data.title.slice(0, 200);
    if (parsed.data.messagesJson != null) updates.messagesJson = parsed.data.messagesJson;
    if (parsed.data.summaryText !== undefined) updates.summaryText = parsed.data.summaryText;

    const [updated] = await db
      .update(budgetPlans)
      .set(updates as Record<string, unknown>)
      .where(eq(budgetPlans.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
    return apiError(error, "Failed to update plan");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    await db.delete(budgetPlans).where(eq(budgetPlans.id, id));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return apiError(error, "Failed to delete plan");
  }
}
