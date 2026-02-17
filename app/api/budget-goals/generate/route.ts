import { NextResponse } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { z } from "zod";
import { generateAndStoreBudgetGoals, getGoalsWithProgress } from "@/lib/ai/budget-goals";
import type { BudgetProfile } from "@/lib/ai/budget-goals";
import { apiError } from "@/lib/api/error";

export const runtime = "nodejs";

const generateRateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 3600,
  blockDuration: 3600,
});

const profileSchema = z.object({
  tier: z.enum(["aggressive", "balanced", "casual"]).optional(),
  monthlyIncome: z.number().positive().optional(),
  priorityCategories: z.array(z.string()).optional(),
  monthlySavingsTarget: z.number().positive().optional(),
  upcomingExpenses: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  try {
    await generateRateLimiter.consume(ip);
  } catch {
    return NextResponse.json(
      { error: "Too many analysis requests. Please wait before re-analyzing." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = profileSchema.safeParse(body);
    const profile: BudgetProfile | undefined = parsed.success && parsed.data.tier
      ? (parsed.data as BudgetProfile)
      : undefined;

    await generateAndStoreBudgetGoals(profile);
    const data = await getGoalsWithProgress();
    return NextResponse.json(data);
  } catch (error: unknown) {
    return apiError(error, "Failed to generate goals");
  }
}
