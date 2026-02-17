import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { savingsTargets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiError } from "@/lib/api/error";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await db.delete(savingsTargets).where(eq(savingsTargets.id, id));
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return apiError(error, "Failed to delete");
  }
}
