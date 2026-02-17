import { NextRequest, NextResponse } from "next/server";
import { syncAllInstitutions } from "@/lib/plaid/sync";
import { maybeRegenerateBudgetGoals } from "@/lib/ai/budget-goals";
import { syncRateLimiter } from "@/lib/auth/rate-limit";
import { apiError } from "@/lib/api/error";
import { isDemoMode } from "@/lib/demo";

export async function POST(req: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.json({ results: [], demo: true });
  }

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    try {
      await syncRateLimiter.consume(ip);
    } catch {
      return NextResponse.json(
        { error: "Too many sync requests. Try again later." },
        { status: 429 }
      );
    }

    const results = await syncAllInstitutions();

    // fire-and-forget — doesn't block sync response
    maybeRegenerateBudgetGoals().catch((err) => {
      console.error("Budget goals regeneration error:", err instanceof Error ? err.message : "Unknown error");
    });

    return NextResponse.json({ results });
  } catch (error: unknown) {
    return apiError(error, "Sync failed");
  }
}
