/**
 * Parse total amount from budget estimate text.
 * Format: TOTAL (X people)  $LOW  $MID  $HIGH
 * Returns MID (middle tier) amount in dollars, or null if not found.
 */
export function parseBudgetTotal(summaryText: string | null): number | null {
  if (!summaryText || !summaryText.includes("TOTAL")) return null;

  const totalLine = summaryText.split("\n").find((l) => l.toUpperCase().includes("TOTAL"));
  if (!totalLine) return null;

  const amounts = totalLine.match(/\$[\d,]+/g);
  if (!amounts || amounts.length < 2) return null;

  const midIndex = Math.floor(amounts.length / 2);
  const midStr = amounts[midIndex].replace(/[$,]/g, "");
  const parsed = parseFloat(midStr);
  return isNaN(parsed) ? null : parsed;
}

export function monthsUntil(targetDate: string): number {
  const target = new Date(targetDate);
  const now = new Date();
  const months =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());
  return Math.max(1, months);
}
