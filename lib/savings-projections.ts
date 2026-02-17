/**
 * Cash flow projection for savings targets.
 * Answers: "If I save $X/month, when will I hit the target?"
 */

export interface ProjectionPoint {
  month: number;
  date: string; // YYYY-MM-DD
  label: string; // "Feb 2026"
  accumulated: number;
  targetAmount: number;
  isGoalReached: boolean;
}

/**
 * Generate monthly projection points from today until target is reached
 * or maxMonths (default 36) is reached.
 */
export function generateSavingsProjection(
  targetAmount: number,
  monthlyAmount: number,
  maxMonths = 36
): ProjectionPoint[] {
  if (monthlyAmount <= 0 || targetAmount <= 0) return [];

  const points: ProjectionPoint[] = [];
  const now = new Date();

  // Start at $0 today
  const startLabel = now.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  points.push({
    month: 0,
    date: now.toISOString().slice(0, 10),
    label: startLabel,
    accumulated: 0,
    targetAmount,
    isGoalReached: false,
  });

  let accumulated = 0;
  for (let monthOffset = 1; monthOffset <= maxMonths; monthOffset++) {
    accumulated += monthlyAmount;
    const date = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const dateStr = date.toISOString().slice(0, 10);
    const label = date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    const isGoalReached = accumulated >= targetAmount;

    points.push({
      month: monthOffset,
      date: dateStr,
      label,
      accumulated: Math.min(accumulated, targetAmount),
      targetAmount,
      isGoalReached,
    });

    if (isGoalReached) break;
  }

  return points;
}

/**
 * Compute months until target is reached at given monthly rate.
 */
export function monthsUntilGoal(
  targetAmount: number,
  monthlyAmount: number
): number {
  if (monthlyAmount <= 0) return Infinity;
  return Math.ceil(targetAmount / monthlyAmount);
}

/**
 * Get the target date (YYYY-MM-DD) when goal will be reached.
 */
export function projectedGoalDate(
  targetAmount: number,
  monthlyAmount: number,
  startDate = new Date()
): string {
  const months = monthsUntilGoal(targetAmount, monthlyAmount);
  const d = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}
