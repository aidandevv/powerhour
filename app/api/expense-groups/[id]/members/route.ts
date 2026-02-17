import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { expenseGroups, expenseGroupMembers } from "@/lib/db/schema";
import { apiError } from "@/lib/api/error";
import { z } from "zod";

const addMembersSchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1).max(100),
});

export async function POST(
  req: NextRequest,
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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = addMembersSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "transactionIds array required" }, { status: 400 });
    }

    const added: string[] = [];
    for (const tid of parsed.data.transactionIds) {
      try {
        await db
          .insert(expenseGroupMembers)
          .values({
            groupId: params.id,
            transactionId: tid,
          })
          .onConflictDoNothing({
            target: [expenseGroupMembers.groupId, expenseGroupMembers.transactionId],
          });
        added.push(tid);
      } catch {
        // Skip duplicates
      }
    }

    return NextResponse.json({ added });
  } catch (error: unknown) {
    return apiError(error, "Failed to add members");
  }
}
