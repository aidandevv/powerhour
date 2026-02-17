/** Streaming chat endpoint for the Ticker AI agent. */
import { type UIMessage } from "ai";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { runAgent } from "@/lib/agent/agent";
import { apiError } from "@/lib/api/error";

export const runtime = "nodejs";

const chatRateLimiter = new RateLimiterMemory({
  points: 20,       // 20 messages
  duration: 60,     // per minute
  blockDuration: 30, // block for 30 seconds if exceeded
});

export async function POST(req: Request) {
  try {
    // Rate limiting by IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    try {
      await chatRateLimiter.consume(ip);
    } catch {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a moment." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const messages: UIMessage[] = body.messages ?? [];

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "No messages provided." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await runAgent(messages);

    return result.toUIMessageStreamResponse();
  } catch (error: unknown) {
    console.error("[ai/chat] Error:", error instanceof Error ? error.message : "Unknown error");
    return apiError(error, "Something went wrong");
  }
}
