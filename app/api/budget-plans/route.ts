import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { budgetPlans } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { apiError } from "@/lib/api/error";

export const runtime = "nodejs";

export async function GET() {
  try {
    const plans = await db
      .select()
      .from(budgetPlans)
      .orderBy(desc(budgetPlans.createdAt));

    return NextResponse.json(plans);
  } catch (error: unknown) {
    return apiError(error, "Failed to fetch plans");
  }
}

const createPlanSchema = z.object({
  title: z.string().min(1).max(500),
  messagesJson: z.array(z.any()),
  summaryText: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createPlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const { title, messagesJson, summaryText } = parsed.data;

    const [created] = await db
      .insert(budgetPlans)
      .values({
        title: title.slice(0, 200),
        messagesJson,
        summaryText: summaryText ?? null,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    return apiError(error, "Failed to save plan");
  }
}
