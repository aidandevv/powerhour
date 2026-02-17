/**
 * Add transaction IDs to an expense group.
 * Use after createExpenseGroup or when user says "add these to my Japan Trip group".
 */
import { db } from "@/lib/db";
import { expenseGroupMembers } from "@/lib/db/schema";
import { z } from "zod";

export const addTransactionsToGroupSchema = z.object({
  groupId: z.string().uuid().describe("Expense group ID to add transactions to"),
  transactionIds: z
    .array(z.string().uuid())
    .min(1)
    .max(100)
    .describe("Transaction IDs to add"),
});

export interface AddTransactionsToGroupResult {
  added: number;
  skipped: number;
  groupId: string;
}

export async function addTransactionsToGroup(params: {
  groupId: string;
  transactionIds: string[];
}): Promise<AddTransactionsToGroupResult> {
  const { groupId, transactionIds } = addTransactionsToGroupSchema.parse(params);

  let added = 0;
  let skipped = 0;

  for (const transactionId of transactionIds) {
    try {
      const result = await db
        .insert(expenseGroupMembers)
        .values({ groupId, transactionId })
        .onConflictDoNothing({
          target: [expenseGroupMembers.groupId, expenseGroupMembers.transactionId],
        })
        .returning({ id: expenseGroupMembers.id });
      if (result.length > 0) added += 1;
      else skipped += 1;
    } catch {
      skipped += 1;
    }
  }

  return { added, skipped, groupId };
}
