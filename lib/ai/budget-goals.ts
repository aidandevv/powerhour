/**
 * AI-driven SMART budget goals generation and progress tracking.
 *
 * Analyzes 3 months of categorized spend vs. prior 3 months,
 * incorporates recurring expenses, and surfaces exactly 3 goals.
 */
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { and, eq, gt, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { budgetGoals, transactions } from "@/lib/db/schema";
import { getSpendingSummary } from "@/lib/agent/tools/spending-summary";
import { getRecurringExpenses } from "@/lib/agent/tools/recurring-expenses";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ─── Zod schema for AI output ─────────────────────────────────────────────────

const goalsOutputSchema = z.object({
  goals: z
    .array(
      z.object({
        category: z.string(),
        categoryLabel: z.string(),
        targetType: z.enum(["cap", "percent_reduction", "savings"]),
        monthlyTarget: z.number().positive(),
        baselineMonthlySpend: z.number().positive(),
        rationale: z.string().max(300),
      })
    )
    .length(3),
});

// ─── Date helpers ─────────────────────────────────────────────────────────────

function dateRanges() {
  const now = new Date();

  // Recent 3 months: start of (now - 3 months) → yesterday
  const recentTo = new Date(now);
  recentTo.setDate(recentTo.getDate() - 1);

  const recentFrom = new Date(now);
  recentFrom.setMonth(recentFrom.getMonth() - 3);
  recentFrom.setDate(1);

  // Prior 3 months: 6 months ago → 3 months ago
  const priorTo = new Date(recentFrom);
  priorTo.setDate(priorTo.getDate() - 1);

  const priorFrom = new Date(priorTo);
  priorFrom.setMonth(priorFrom.getMonth() - 3);
  priorFrom.setDate(1);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return {
    recentFrom: fmt(recentFrom),
    recentTo: fmt(recentTo),
    priorFrom: fmt(priorFrom),
    priorTo: fmt(priorTo),
  };
}

function startOfCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

// ─── Profile type ──────────────────────────────────────────────────────────────

export type BudgetTier = "aggressive" | "balanced" | "casual";

export interface BudgetProfile {
  tier: BudgetTier;
  monthlyIncome?: number;          // after-tax take-home
  priorityCategories?: string[];   // e.g. ["FOOD_AND_DRINK", "ENTERTAINMENT"]
  monthlySavingsTarget?: number;
  upcomingExpenses?: string;       // free text, optional
}

const TIER_SYSTEM_INSTRUCTIONS: Record<BudgetTier, string> = {
  aggressive:
    "The user wants AGGRESSIVE goals. Set targets that are 20-35% below their current baseline spend " +
    "for discretionary categories. Prioritize maximum savings. Be bold — the user is motivated.",
  balanced:
    "The user wants BALANCED goals. Set targets 10-20% below current spend. " +
    "Balance meaningful savings with quality of life. Be realistic and sustainable.",
  casual:
    "The user wants CASUAL goals. Set gentle targets — 5-10% below current spend, or at current levels " +
    "for non-discretionary categories. Focus on awareness and small, achievable wins.",
};

// ─── Prompt builder ────────────────────────────────────────────────────────────

function buildGoalsPrompt(
  recentSummary: { category: string; amount: number; count: number }[],
  priorSummary: { category: string; amount: number; count: number }[],
  recurringMonthly: number,
  recurringItems: { name: string; amount: number; frequency: string }[],
  profile?: BudgetProfile
): string {
  const priorMap = new Map(priorSummary.map((r) => [r.category, r.amount]));

  const recentMonths = 3;
  const top10 = recentSummary.slice(0, 10).map((r) => {
    const monthlyAvg = r.amount / recentMonths;
    const priorTotal = priorMap.get(r.category) ?? 0;
    const priorMonthly = priorTotal / recentMonths;
    const delta =
      priorMonthly > 0
        ? Math.round(((monthlyAvg - priorMonthly) / priorMonthly) * 100)
        : null;
    const deltaStr =
      delta !== null
        ? delta >= 0
          ? ` (+${delta}% vs prior 3mo)`
          : ` (${delta}% vs prior 3mo)`
        : " (no prior data)";
    return `  - ${r.category}: $${monthlyAvg.toFixed(2)}/mo avg${deltaStr}`;
  });

  const recurringLines = recurringItems
    .slice(0, 8)
    .map((i) => `  - ${i.name}: $${i.amount.toFixed(2)} (${i.frequency})`);

  const profileLines: string[] = [];
  if (profile) {
    if (profile.monthlyIncome) {
      profileLines.push(`Monthly take-home income: $${profile.monthlyIncome.toLocaleString()}`);
    }
    if (profile.priorityCategories?.length) {
      profileLines.push(`User's priority categories (focus here first): ${profile.priorityCategories.join(", ")}`);
    }
    if (profile.monthlySavingsTarget) {
      profileLines.push(`Monthly savings target: $${profile.monthlySavingsTarget.toLocaleString()}`);
    }
    if (profile.upcomingExpenses) {
      profileLines.push(`Upcoming big expenses: ${profile.upcomingExpenses}`);
    }
  }

  const profileSection = profileLines.length
    ? `\nUSER PROFILE:\n${profileLines.map((l) => `  - ${l}`).join("\n")}\n`
    : "";

  return `RECENT SPENDING (last 3 months, top categories by total, averaged to monthly):
${top10.join("\n")}

RECURRING EXPENSES (monthly estimate: $${recurringMonthly.toFixed(2)}/mo):
${recurringLines.join("\n") || "  None detected"}
${profileSection}
Generate exactly 3 SMART budget goals targeting the categories with the highest savings potential.`;
}

// ─── Core generation ───────────────────────────────────────────────────────────

export async function generateAndStoreBudgetGoals(profile?: BudgetProfile): Promise<void> {
  const { recentFrom, recentTo, priorFrom, priorTo } = dateRanges();

  const [recent, prior, recurring] = await Promise.all([
    getSpendingSummary({ from: recentFrom, to: recentTo }),
    getSpendingSummary({ from: priorFrom, to: priorTo }),
    getRecurringExpenses(),
  ]);

  const prompt = buildGoalsPrompt(
    recent.summary,
    prior.summary,
    recurring.totalMonthlyEstimate,
    recurring.items,
    profile
  );

  const tierInstruction = profile?.tier
    ? TIER_SYSTEM_INSTRUCTIONS[profile.tier]
    : TIER_SYSTEM_INSTRUCTIONS.balanced;

  const { object } = await generateObject({
    model: google("gemini-2.5-flash-lite"),
    schema: goalsOutputSchema,
    system:
      "You are a financial coach. Analyze spending data and create exactly 3 SMART budget goals. " +
      "Each goal must target a specific category where meaningful savings are possible. " +
      "Choose the format that best fits each category — a monthly cap (cap), a percentage reduction " +
      "from baseline (percent_reduction), or framed as annual savings (savings). " +
      "Be specific, realistic, and brief in the rationale (2-3 sentences max). " +
      tierInstruction,
    prompt,
    abortSignal: AbortSignal.timeout(30_000),
  });

  // Persist: delete old 'suggested' goals, insert 3 new ones
  await db.transaction(async (tx) => {
    await tx.delete(budgetGoals).where(eq(budgetGoals.status, "suggested"));

    await tx.insert(budgetGoals).values(
      object.goals.map((g) => ({
        category: g.category,
        categoryLabel: g.categoryLabel,
        targetType: g.targetType,
        monthlyTarget: String(g.monthlyTarget),
        baselineMonthlySpend: String(g.baselineMonthlySpend),
        rationale: g.rationale,
        status: "suggested" as const,
      }))
    );
  });
}

// ─── Staleness guard ──────────────────────────────────────────────────────────

export async function maybeRegenerateBudgetGoals(): Promise<void> {
  const latest = await db
    .select({ generatedAt: budgetGoals.generatedAt })
    .from(budgetGoals)
    .orderBy(sql`${budgetGoals.generatedAt} desc`)
    .limit(1);

  if (latest.length > 0) {
    const ageMs = Date.now() - new Date(latest[0].generatedAt).getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (ageMs < twentyFourHours) return;
  }

  await generateAndStoreBudgetGoals();
}

// ─── Goal row type ────────────────────────────────────────────────────────────

export interface BudgetGoalWithProgress {
  id: string;
  category: string;
  categoryLabel: string;
  targetType: string;
  monthlyTarget: number;
  baselineMonthlySpend: number;
  rationale: string;
  status: string;
  generatedAt: string;
  currentSpend: number;
  progressPercent: number;
  progressStatus: "on_track" | "at_risk" | "near_limit" | "over_budget";
}

// ─── Progress query ───────────────────────────────────────────────────────────

export async function getGoalsWithProgress(): Promise<{
  goals: BudgetGoalWithProgress[];
  lastGeneratedAt: string | null;
}> {
  const activeGoals = await db
    .select()
    .from(budgetGoals)
    .where(inArray(budgetGoals.status, ["suggested", "accepted"]))
    .orderBy(sql`${budgetGoals.generatedAt} desc`);

  if (activeGoals.length === 0) {
    return { goals: [], lastGeneratedAt: null };
  }

  const categories = activeGoals.map((g) => g.category);
  const monthStart = startOfCurrentMonth();

  const spendRows = await db
    .select({
      category: transactions.category,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(
      and(
        gte(transactions.date, monthStart),
        eq(transactions.pending, false),
        gt(transactions.amount, "0"),
        inArray(transactions.category, categories)
      )
    )
    .groupBy(transactions.category);

  const spendMap = new Map(
    spendRows.map((r) => [r.category ?? "Uncategorized", parseFloat(r.total ?? "0")])
  );

  const goals: BudgetGoalWithProgress[] = activeGoals.map((g) => {
    const target = parseFloat(String(g.monthlyTarget));
    const current = spendMap.get(g.category) ?? 0;
    const pct = target > 0 ? (current / target) * 100 : 0;

    let progressStatus: BudgetGoalWithProgress["progressStatus"];
    if (pct >= 100) progressStatus = "over_budget";
    else if (pct >= 90) progressStatus = "near_limit";
    else if (pct >= 70) progressStatus = "at_risk";
    else progressStatus = "on_track";

    return {
      id: g.id,
      category: g.category,
      categoryLabel: g.categoryLabel,
      targetType: g.targetType,
      monthlyTarget: target,
      baselineMonthlySpend: parseFloat(String(g.baselineMonthlySpend)),
      rationale: g.rationale,
      status: g.status,
      generatedAt: g.generatedAt instanceof Date
        ? g.generatedAt.toISOString()
        : String(g.generatedAt),
      currentSpend: current,
      progressPercent: Math.round(pct),
      progressStatus,
    };
  });

  const lastGeneratedAt = goals.length > 0 ? goals[0].generatedAt : null;

  return { goals, lastGeneratedAt };
}

// ─── Single goal creation (for budget planner "cut spending" flow) ─────────────

export interface CreateBudgetGoalParams {
  category: string;
  categoryLabel: string;
  targetType: "cap" | "percent_reduction" | "savings";
  monthlyTarget: number;
  baselineMonthlySpend: number;
  rationale: string;
}

export async function createSingleBudgetGoal(
  params: CreateBudgetGoalParams
): Promise<{ id: string }> {
  const [inserted] = await db
    .insert(budgetGoals)
    .values({
      category: params.category,
      categoryLabel: params.categoryLabel,
      targetType: params.targetType,
      monthlyTarget: String(params.monthlyTarget),
      baselineMonthlySpend: String(params.baselineMonthlySpend),
      rationale: params.rationale,
      status: "suggested",
    })
    .returning();

  if (!inserted) throw new Error("Failed to create budget goal");
  return { id: inserted.id };
}
