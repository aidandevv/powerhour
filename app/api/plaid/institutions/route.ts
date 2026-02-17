import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { institutions } from "@/lib/db/schema";
import { apiError } from "@/lib/api/error";

export async function GET() {
  try {
    const result = await db
      .select({
        id: institutions.id,
        institutionName: institutions.institutionName,
        institutionId: institutions.institutionId,
        status: institutions.status,
        errorCode: institutions.errorCode,
        lastSyncedAt: institutions.lastSyncedAt,
        createdAt: institutions.createdAt,
      })
      .from(institutions);

    return NextResponse.json({ institutions: result });
  } catch (error: unknown) {
    return apiError(error, "Failed to fetch institutions");
  }
}
