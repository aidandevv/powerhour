import { NextResponse } from "next/server";
import { getGoalsWithProgress } from "@/lib/ai/budget-goals";
import { apiError } from "@/lib/api/error";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await getGoalsWithProgress();
    return NextResponse.json(data);
  } catch (error: unknown) {
    return apiError(error, "Failed to fetch goals");
  }
}
