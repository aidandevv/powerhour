import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { apiError } from "@/lib/api/error";

const updateSchema = z.object({
  category: z.string().optional(),
  categoryDetailed: z.string().optional(),
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

    const [updated] = await db
      .update(transactions)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(transactions.id, params.id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
    return apiError(error, "Failed to update transaction");
  }
}
