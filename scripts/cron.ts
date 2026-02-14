import cron from "node-cron";
import { syncAllInstitutions } from "@/lib/plaid/sync";

// Daily sync at 6:00 AM server local time
cron.schedule("0 6 * * *", async () => {
  console.log("Starting daily sync...");
  try {
    const results = await syncAllInstitutions();
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    console.log(`Daily sync complete: ${succeeded} succeeded, ${failed} failed`);
    for (const r of results.filter((r) => !r.success)) {
      console.error(`Sync failed for institution ${r.id}: ${r.error}`);
    }
  } catch (error) {
    console.error("Daily sync failed:", error);
  }
});

console.log("Cron scheduler started. Daily sync scheduled at 6:00 AM.");
