/**
 * In-process scheduler — started by instrumentation.ts on server startup.
 * Both jobs check the DB toggle before running so changes in Settings
 * take effect on the next scheduled tick without a restart.
 */
import cron from "node-cron";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { syncAllInstitutions } from "@/lib/plaid/sync";
import { generateWeeklyDigest } from "@/lib/digest/generate";

async function isJobEnabled(
  field: "syncScheduleEnabled" | "digestScheduleEnabled"
): Promise<boolean> {
  try {
    const [row] = await db
      .select({ [field]: userSettings[field] })
      .from(userSettings)
      .limit(1);
    // Default to enabled if no settings row exists yet
    return (row as Record<string, boolean> | undefined)?.[field] ?? true;
  } catch {
    return true; // Fail open — never silently skip due to a DB error
  }
}

export function startScheduler(): void {
  // Daily Plaid sync at 06:00 server-local time
  cron.schedule("0 6 * * *", async () => {
    if (!(await isJobEnabled("syncScheduleEnabled"))) {
      console.log("[scheduler] Daily sync skipped (disabled in settings)");
      return;
    }
    console.log("[scheduler] Starting daily sync...");
    try {
      const results = await syncAllInstitutions();
      const ok = results.filter((r) => r.success).length;
      const fail = results.filter((r) => !r.success).length;
      console.log(`[scheduler] Daily sync complete: ${ok} ok, ${fail} failed`);
    } catch (err) {
      console.error("[scheduler] Daily sync error:", err instanceof Error ? err.message : err);
    }
  });

  // Weekly financial digest every Monday at 08:00
  cron.schedule("0 8 * * 1", async () => {
    if (!(await isJobEnabled("digestScheduleEnabled"))) {
      console.log("[scheduler] Weekly digest skipped (disabled in settings)");
      return;
    }
    console.log("[scheduler] Generating weekly digest...");
    try {
      const digest = await generateWeeklyDigest();
      console.log(`[scheduler] Digest saved (id=${digest.id})`);
    } catch (err) {
      console.error("[scheduler] Digest error:", err instanceof Error ? err.message : err);
    }
  });

  console.log("[scheduler] Started — daily sync at 06:00, weekly digest Mondays at 08:00");
}
