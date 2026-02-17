/**
 * Create-savings-target tool for the budget planner agent.
 * Inserts a savings target directly into the database so the agent can
 * fulfil natural-language requests like "have $5k saved by May".
 */
import { db } from "@/lib/db";
import { savingsTargets } from "@/lib/db/schema";

export interface CreateSavingsTargetParams {
  /** Human-readable name, e.g. "Emergency fund – May 2026" */
  name: string;
  /** Target amount in dollars */
  targetAmount: number;
  /** ISO date string YYYY-MM-DD when the goal should be reached */
  targetDate: string;
}

export interface CreateSavingsTargetResult {
  success: boolean;
  id?: string;
  name: string;
  targetAmount: number;
  targetDate: string;
  /** Computed monthly savings required to hit the goal */
  monthlyAmount: number;
  /** Months remaining until the target date */
  monthsRemaining: number;
  summary: string;
}

export async function createSavingsTargetRecord(
  params: CreateSavingsTargetParams
): Promise<CreateSavingsTargetResult> {
  const { name, targetAmount, targetDate } = params;

  const target = new Date(targetDate + "T12:00:00");
  const now = new Date();
  const monthsRemaining = Math.max(
    1,
    (target.getFullYear() - now.getFullYear()) * 12 +
      (target.getMonth() - now.getMonth())
  );
  const monthlyAmount = targetAmount / monthsRemaining;

  const dateLabel = target.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  try {
    const [created] = await db
      .insert(savingsTargets)
      .values({
        name,
        targetAmount: String(targetAmount),
        targetDate,
        monthlyAmount: String(monthlyAmount.toFixed(2)),
        budgetPlanId: null,
      })
      .returning();

    return {
      success: true,
      id: created.id,
      name: created.name,
      targetAmount: parseFloat(created.targetAmount),
      targetDate: created.targetDate,
      monthlyAmount: parseFloat(created.monthlyAmount),
      monthsRemaining,
      summary: `Savings target "${name}" created! You'll need to save $${monthlyAmount.toFixed(0)}/month for ${monthsRemaining} months to reach $${targetAmount.toLocaleString("en-US")} by ${dateLabel}.`,
    };
  } catch (err) {
    console.error("[create-savings-target] DB error:", err);
    return {
      success: false,
      name,
      targetAmount,
      targetDate,
      monthlyAmount,
      monthsRemaining,
      summary: `Could not save to dashboard (DB error), but here's your plan: save $${monthlyAmount.toFixed(0)}/month for ${monthsRemaining} months to reach $${targetAmount.toLocaleString("en-US")} by ${dateLabel}.`,
    };
  }
}
