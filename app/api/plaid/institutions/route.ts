import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { institutions } from "@/lib/db/schema";

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
    const message = error instanceof Error ? error.message : "Failed to fetch institutions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
