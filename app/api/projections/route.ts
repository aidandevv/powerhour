import { NextRequest, NextResponse } from "next/server";
import { getProjectionSummary } from "@/lib/projections";
import { apiError } from "@/lib/api/error";

export async function GET(req: NextRequest) {
  try {
    const days = parseInt(
      req.nextUrl.searchParams.get("days") || "90",
      10
    );

    const summary = await getProjectionSummary(days);
    return NextResponse.json(summary);
  } catch (error: unknown) {
    return apiError(error, "Failed to fetch projections");
  }
}
