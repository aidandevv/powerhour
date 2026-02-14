import { NextRequest, NextResponse } from "next/server";
import { getProjectionSummary } from "@/lib/projections";

export async function GET(req: NextRequest) {
  try {
    const days = parseInt(
      req.nextUrl.searchParams.get("days") || "90",
      10
    );

    const summary = await getProjectionSummary(days);
    return NextResponse.json(summary);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch projections";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
