/**
 * Budget goals tool — shows AI-generated budget goals with current progress.
 * Use when user asks "what are my budget goals?", "show my budget progress", "how am I doing on my budget goals?", etc.
 */
import { getGoalsWithProgress } from "@/lib/ai/budget-goals";

export interface BudgetGoal {
  id: string;
  category: string;
  categoryLabel: string;
  monthlyTarget: number;
  baselineMonthlySpend: number;
  currentSpend: number;
  remaining: number;
  progressPercent: number;
  status: "on-track" | "warning" | "exceeded";
  progressStatus: "on_track" | "at_risk" | "near_limit" | "over_budget";
}

export interface BudgetGoalsResult {
  goals: BudgetGoal[];
  summary: string;
  totalBudget: number;
  totalSpend: number;
  exceeded: number;
}

export async function getBudgetGoals(): Promise<BudgetGoalsResult> {
  const data = await getGoalsWithProgress();

  const goals: BudgetGoal[] = data.goals.map((g) => ({
    id: g.id,
    category: g.category,
    categoryLabel: g.categoryLabel,
    monthlyTarget: g.monthlyTarget,
    baselineMonthlySpend: g.baselineMonthlySpend,
    currentSpend: g.currentSpend,
    remaining: g.monthlyTarget - g.currentSpend,
    progressPercent: g.progressPercent,
    status: g.progressStatus === "over_budget" ? "exceeded" : g.progressStatus === "near_limit" ? "warning" : "on-track",
    progressStatus: g.progressStatus,
  }));

  const totalBudget = goals.reduce((sum, g) => sum + g.monthlyTarget, 0);
  const totalSpend = goals.reduce((sum, g) => sum + g.currentSpend, 0);
  const exceeded = goals.filter((g) => g.status === "exceeded").length;

  let summary = "";
  if (goals.length === 0) {
    summary = "No budget goals found. You can create budget goals via the budget planner.";
  } else {
    summary = `You have ${goals.length} budget goal${goals.length > 1 ? "s" : ""} with a total monthly budget of $${totalBudget.toFixed(0)}. Current spend: $${totalSpend.toFixed(0)} (${((totalSpend / totalBudget) * 100).toFixed(0)}%).`;
    if (exceeded > 0) {
      summary += ` **${exceeded} goal${exceeded > 1 ? "s" : ""} exceeded.**`;
    } else {
      summary += " All goals are on track or in warning status.";
    }
  }

  return {
    goals,
    summary,
    totalBudget,
    totalSpend,
    exceeded,
  };
}
