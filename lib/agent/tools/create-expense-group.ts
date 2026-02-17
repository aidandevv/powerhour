/**
 * Create an expense group (e.g. for a trip).
 * Use when user says "create a group called Japan Trip" or "group my expenses as March vacation".
 */
import { db } from "@/lib/db";
import { expenseGroups } from "@/lib/db/schema";
import { z } from "zod";

export const createExpenseGroupSchema = z.object({
  name: z.string().min(1).max(200).describe("Group name (e.g. Japan Trip)"),
  description: z.string().max(500).optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Optional start date hint (YYYY-MM-DD)"),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Optional end date hint (YYYY-MM-DD)"),
});

export interface CreateExpenseGroupResult {
  id: string;
  name: string;
  dateFrom: string | null;
  dateTo: string | null;
}

export async function createExpenseGroup(params: {
  name: string;
  description?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<CreateExpenseGroupResult> {
  const { name, description, dateFrom, dateTo } =
    createExpenseGroupSchema.parse(params);

  const [created] = await db
    .insert(expenseGroups)
    .values({
      name,
      description: description ?? null,
      dateFrom: dateFrom ?? null,
      dateTo: dateTo ?? null,
    })
    .returning();

  if (!created) throw new Error("Failed to create expense group");

  return {
    id: created.id,
    name: created.name,
    dateFrom: created.dateFrom,
    dateTo: created.dateTo,
  };
}
