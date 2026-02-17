/**
 * Debt payoff calculator — given credit account balances, compute payoff timelines
 * at the current minimum-payment pace and at accelerated payment levels.
 *
 * APR is not stored in the DB so we use a conservative default (24 %) and
 * tell the user to substitute their actual rate.
 */
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export interface DebtPayoffAccount {
  id: string;
  name: string;
  balance: number;
  creditLimit: number | null;
  utilizationPct: number | null;
  /** Months to pay off at minimum payment (2 % of balance) */
  monthsAtMinimum: number | null;
  /** Months to pay off at 3 % of balance */
  monthsAt3Pct: number | null;
  /** Total interest paid at minimum payment */
  totalInterestAtMinimum: number | null;
  /** Total interest paid at 3 % of balance */
  totalInterestAt3Pct: number | null;
  monthlyMinimumPayment: number;
  monthly3PctPayment: number;
}

export interface DebtPayoffResult {
  accounts: DebtPayoffAccount[];
  totalDebt: number;
  totalInterestAtMinimum: number;
  totalInterestAt3Pct: number;
  summary: string;
  note: string;
}

const DEFAULT_APR = 0.24;

function computePayoff(
  balance: number,
  monthlyPayment: number,
  annualRate: number
): { months: number; totalInterest: number } | null {
  if (balance <= 0 || monthlyPayment <= 0) return null;
  const monthlyRate = annualRate / 12;
  const minViable = balance * monthlyRate;
  if (monthlyPayment <= minViable) return null;

  let remaining = balance;
  let months = 0;
  let totalInterest = 0;

  while (remaining > 0.01 && months < 600) {
    const interest = remaining * monthlyRate;
    totalInterest += interest;
    remaining = remaining + interest - monthlyPayment;
    if (remaining < 0) remaining = 0;
    months++;
  }

  return { months, totalInterest: Math.round(totalInterest * 100) / 100 };
}

export async function getDebtPayoff(): Promise<DebtPayoffResult> {
  const creditAccounts = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      currentBalance: accounts.currentBalance,
      creditLimit: accounts.creditLimit,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.type, "credit"),
        eq(accounts.isActive, true)
      )
    );

  const payoffAccounts: DebtPayoffAccount[] = [];
  let totalDebt = 0;
  let totalInterestMin = 0;
  let totalInterest3 = 0;

  for (const acct of creditAccounts) {
    const balance = parseFloat(String(acct.currentBalance ?? "0"));
    if (balance <= 0) continue;

    totalDebt += balance;

    const creditLimit = acct.creditLimit
      ? parseFloat(String(acct.creditLimit))
      : null;
    const utilizationPct =
      creditLimit && creditLimit > 0
        ? Math.round((balance / creditLimit) * 100)
        : null;

    const minPayment = Math.max(25, balance * 0.02); // 2 % or $25 minimum
    const payment3Pct = Math.max(25, balance * 0.03); // 3 % accelerated

    const atMin = computePayoff(balance, minPayment, DEFAULT_APR);
    const at3 = computePayoff(balance, payment3Pct, DEFAULT_APR);

    if (atMin) totalInterestMin += atMin.totalInterest;
    if (at3) totalInterest3 += at3.totalInterest;

    payoffAccounts.push({
      id: acct.id,
      name: acct.name,
      balance,
      creditLimit,
      utilizationPct,
      monthsAtMinimum: atMin?.months ?? null,
      monthsAt3Pct: at3?.months ?? null,
      totalInterestAtMinimum: atMin?.totalInterest ?? null,
      totalInterestAt3Pct: at3?.totalInterest ?? null,
      monthlyMinimumPayment: Math.round(minPayment * 100) / 100,
      monthly3PctPayment: Math.round(payment3Pct * 100) / 100,
    });
  }

  const interestSaved = totalInterestMin - totalInterest3;
  const summary =
    payoffAccounts.length === 0
      ? "No active credit accounts found."
      : `Total credit debt: $${totalDebt.toFixed(2)} across ${payoffAccounts.length} account${payoffAccounts.length > 1 ? "s" : ""}. ` +
        `Paying 3% monthly vs minimum saves approximately $${interestSaved.toFixed(2)} in interest.`;

  return {
    accounts: payoffAccounts,
    totalDebt,
    totalInterestAtMinimum: Math.round(totalInterestMin * 100) / 100,
    totalInterestAt3Pct: Math.round(totalInterest3 * 100) / 100,
    summary,
    note: `Calculations assume a ${DEFAULT_APR * 100}% APR. Substitute your card's actual APR for precise results.`,
  };
}
