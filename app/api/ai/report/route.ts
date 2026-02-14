/**
 * PDF Report Generation API
 *
 * PDF-01: Dashboard button triggers this endpoint
 * PDF-03: AI-generated narrative via Gemini
 * PDF-05: Chat agent can also trigger report generation
 * PDF-06: No files written to disk — binary buffer response
 *
 * Uses Node.js runtime for DB access and PDFKit.
 */
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { getSpendingSummary } from "@/lib/agent/tools/spending-summary";
import { generatePdfReport } from "@/lib/ai/pdf";

export const runtime = "nodejs";

const reportRateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60,
  blockDuration: 60,
});

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const requestSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    try {
      await reportRateLimiter.consume(ip);
    } catch {
      return new Response(
        JSON.stringify({ error: "Too many report requests. Please wait." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid date range. Use YYYY-MM-DD format." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { from, to } = parsed.data;

    // Get spending data
    const spending = await getSpendingSummary({ from, to });

    // Generate AI narrative (non-streaming, since we need the full text for the PDF)
    const { text: narrative } = await generateText({
      model: google("gemini-2.5-flash-lite"),
      system:
        "You are a financial data analyst. Write a concise 2-3 paragraph summary of the user's spending data. Focus on notable patterns, top categories, and any significant amounts. Do NOT give financial advice. Be factual and data-driven.",
      prompt: `Summarize this spending data for ${from} to ${to}:\n\nTotal spend: $${spending.totalSpend.toFixed(2)}\n\nBreakdown by category:\n${spending.summary
        .map(
          (r) =>
            `- ${r.category}: $${r.amount.toFixed(2)} (${r.count} transactions)`
        )
        .join("\n")}`,
      abortSignal: AbortSignal.timeout(15_000),
    });

    // Detect anomalies: categories where spending is >2x the average category spend
    const anomalies: string[] = [];
    if (spending.summary.length > 1) {
      const avg = spending.totalSpend / spending.summary.length;
      for (const row of spending.summary) {
        if (row.amount > avg * 2) {
          anomalies.push(
            `${row.category.split("_").map((w) => w === "AND" ? "&" : w.charAt(0) + w.slice(1).toLowerCase()).join(" ")} spending ($${row.amount.toFixed(2)}) is significantly above average ($${avg.toFixed(2)} per category).`
          );
        }
      }
    }

    // Generate PDF
    const pdfBuffer = await generatePdfReport({
      from,
      to,
      spending,
      narrative,
      anomalies,
    });

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="financial-report-${from}-to-${to}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error: unknown) {
    console.error("[ai/report] Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate report";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
