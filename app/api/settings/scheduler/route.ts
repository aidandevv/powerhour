/**
 * GET  /api/settings/scheduler — read current scheduler toggle state
 * PATCH /api/settings/scheduler — update one or both toggles
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { z } from "zod";
import { apiError } from "@/lib/api/error";

const patchSchema = z.object({
  syncScheduleEnabled: z.boolean().optional(),
  digestScheduleEnabled: z.boolean().optional(),
});

export async function GET() {
  try {
    const [row] = await db
      .select({
        syncScheduleEnabled: userSettings.syncScheduleEnabled,
        digestScheduleEnabled: userSettings.digestScheduleEnabled,
      })
      .from(userSettings)
      .limit(1);

    return NextResponse.json({
      syncScheduleEnabled: row?.syncScheduleEnabled ?? true,
      digestScheduleEnabled: row?.digestScheduleEnabled ?? true,
    });
  } catch (error: unknown) {
    return apiError(error, "Failed to read scheduler settings");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    await db
      .insert(userSettings)
      .values({ id: "default", ...parsed.data })
      .onConflictDoUpdate({
        target: userSettings.id,
        set: { ...parsed.data, updatedAt: new Date() },
      });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return apiError(error, "Failed to update scheduler settings");
  }
}
