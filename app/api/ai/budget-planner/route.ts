/**
 * Budget Planner streaming API endpoint
 *
 * Rate limit: 3/hour per IP (each session triggers 5+ Gemini calls)
 * Streams via toUIMessageStreamResponse()
 */
import { type UIMessage } from "ai";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { runBudgetPlannerAgent } from "@/lib/agent/budget-planner-agent";
import { apiError } from "@/lib/api/error";

export const runtime = "nodejs";

const plannerRateLimiter = new RateLimiterMemory({
  points: 3,
  duration: 3600,
  blockDuration: 3600,
});

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    try {
      await plannerRateLimiter.consume(ip);
    } catch {
      return new Response(
        JSON.stringify({ error: "Rate limit reached. Budget planner is limited to 3 sessions per hour." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const messages: UIMessage[] = body.messages ?? [];
    const budgetContext = body.budgetContext as
      | { estimatedTotal: number; planTitle: string }
      | undefined;

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "No messages provided." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const options =
      budgetContext &&
      typeof budgetContext.estimatedTotal === "number" &&
      typeof budgetContext.planTitle === "string"
        ? { budgetContext }
        : undefined;

    const result = await runBudgetPlannerAgent(messages, options);

    return result.toUIMessageStreamResponse();
  } catch (error: unknown) {
    console.error("[ai/budget-planner] Error:", error instanceof Error ? error.message : "Unknown error");
    return apiError(error, "Something went wrong");
  }
}
