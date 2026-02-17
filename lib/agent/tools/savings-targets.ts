/**
 * Savings targets tool — shows active savings goals and progress toward each target.
 * Use when user asks "what are my savings goals?", "show my savings targets", "am I on track for my savings goal?", etc.
 */
import { db } from "@/lib/db";
import { savingsTargets } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export interface SavingsTarget {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string;
  monthlyAmount: number;
  monthsRemaining: number;
  daysRemaining: number;
}

export interface SavingsTargetsResult {
  targets: SavingsTarget[];
  summary: string;
  totalTarget: number;
  totalMonthly: number;
}

export async function getSavingsTargets(): Promise<SavingsTargetsResult> {
  const rows = await db
    .select()
    .from(savingsTargets)
    .orderBy(desc(savingsTargets.createdAt));

  const now = new Date();
  const targets: SavingsTarget[] = rows.map((r) => {
    const targetDate = new Date(r.targetDate);
    const daysRemaining = Math.max(0, Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const monthsRemaining = Math.max(0, Math.ceil(daysRemaining / 30));

    return {
      id: r.id,
      name: r.name,
      targetAmount: parseFloat(r.targetAmount),
      targetDate: r.targetDate,
      monthlyAmount: parseFloat(r.monthlyAmount),
      monthsRemaining,
      daysRemaining,
    };
  });

  const totalTarget = targets.reduce((sum, t) => sum + t.targetAmount, 0);
  const totalMonthly = targets.reduce((sum, t) => sum + t.monthlyAmount, 0);

  let summary = "";
  if (targets.length === 0) {
    summary = "No savings targets found. You can create savings targets via the budget planner or by asking Ticker to create one.";
  } else {
    summary = `You have ${targets.length} savings target${targets.length > 1 ? "s" : ""} totaling $${totalTarget.toFixed(0)}. You need to save $${totalMonthly.toFixed(0)}/month to reach all targets on time.`;

    const upcoming = targets.filter((t) => t.daysRemaining <= 90 && t.daysRemaining > 0);
    if (upcoming.length > 0) {
      summary += ` **${upcoming.length} target${upcoming.length > 1 ? "s" : ""} due within 90 days.**`;
    }
  }

  return {
    targets,
    summary,
    totalTarget,
    totalMonthly,
  };
}
