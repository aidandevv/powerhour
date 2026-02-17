/**
 * GET /api/audit-log — returns the 100 most recent audit events.
 * Used by the Settings page security log view.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { apiError } from "@/lib/api/error";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        ip: auditLog.ip,
        metadata: auditLog.metadata,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(100);

    return NextResponse.json({ events: rows });
  } catch (error: unknown) {
    return apiError(error, "Failed to fetch audit log");
  }
}
