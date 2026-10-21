import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { expenseGroupMembers } from "@/lib/db/schema";
import { apiError } from "@/lib/api/error";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
  try {
    const { id, transactionId } = await params;
    const [deleted] = await db
      .delete(expenseGroupMembers)
      .where(
        and(
          eq(expenseGroupMembers.groupId, id),
          eq(expenseGroupMembers.transactionId, transactionId)
        )
      )
      .returning({ id: expenseGroupMembers.id });

    if (!deleted) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return apiError(error, "Failed to remove member");
  }
}
