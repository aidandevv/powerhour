/**
 * GET /api/subscriptions — returns recurring items with audit data
 * (days since last seen, flagged status).
 */
import { NextResponse } from "next/server";
import { auditRecurringExpenses } from "@/lib/agent/tools/recurring-audit";
import { apiError } from "@/lib/api/error";

export async function GET() {
  try {
    const result = await auditRecurringExpenses();
    return NextResponse.json(result);
  } catch (error: unknown) {
    return apiError(error, "Failed to fetch subscription data");
  }
}
