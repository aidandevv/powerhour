/**
 * Savings projection tool for budget planner.
 * Answers: "If I save $X/month toward this trip, when will I reach the target?"
 * and: "How much do I need to save per month to reach $X by [date]?"
 */
import {
  monthsUntilGoal,
  projectedGoalDate,
} from "@/lib/savings-projections";

export interface SavingsProjectionParams {
  /** Target amount in dollars (from budget estimate) */
  targetAmount: number;
  /** Monthly savings amount - if provided, compute months/date to reach goal */
  monthlyAmount?: number;
  /** Target date YYYY-MM-DD - if provided (and no monthlyAmount), compute required monthly */
  targetDate?: string;
}

export interface SavingsProjectionResult {
  targetAmount: number;
  /** Months until goal (when monthlyAmount is provided) */
  monthsUntilGoal?: number;
  /** Projected date when goal is reached (YYYY-MM-DD) */
  projectedDate?: string;
  /** Required monthly amount to reach goal by targetDate */
  requiredMonthlyAmount?: number;
  /** Human-readable summary */
  summary: string;
}

export function computeSavingsProjection(
  params: SavingsProjectionParams
): SavingsProjectionResult {
  const { targetAmount, monthlyAmount, targetDate } = params;

  if (targetAmount <= 0) {
    return {
      targetAmount,
      summary: "Please provide a valid target amount.",
    };
  }

  // Case 1: User specified monthly amount → compute timeline
  if (monthlyAmount != null && monthlyAmount > 0) {
    const months = monthsUntilGoal(targetAmount, monthlyAmount);
    const date = projectedGoalDate(targetAmount, monthlyAmount);
    const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    return {
      targetAmount,
      monthsUntilGoal: months,
      projectedDate: date,
      summary: `At $${monthlyAmount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/month, you'll reach $${targetAmount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} in **${months} months** (${dateLabel}). Use "Save toward this" to track your progress on the dashboard.`,
    };
  }

  // Case 2: User specified target date → compute required monthly
  if (targetDate) {
    const target = new Date(targetDate + "T12:00:00");
    const now = new Date();
    const months = Math.max(
      1,
      (target.getFullYear() - now.getFullYear()) * 12 +
        (target.getMonth() - now.getMonth())
    );
    const required = Math.ceil((targetAmount / months) * 100) / 100;
    const dateLabel = target.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    return {
      targetAmount,
      requiredMonthlyAmount: required,
      summary: `To reach $${targetAmount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} by ${dateLabel}, you'd need to save **$${required.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/month** (${months} months). Use "Save toward this" to add it as a goal.`,
    };
  }

  return {
    targetAmount,
    summary: "Specify either a monthly amount (e.g. $300/month) or a target date (e.g. May 2027) to see your savings timeline.",
  };
}
