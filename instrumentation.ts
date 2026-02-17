/**
 * Next.js instrumentation hook — runs once on server startup.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * When DEMO_MODE=true, seeds the database with realistic fake data so the
 * app is fully usable without Plaid credentials.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Ensure agent database views exist (critical for all agent tools)
    try {
      const { ensureAgentViews } = await import("./lib/db/ensure-views");
      await ensureAgentViews();
    } catch (err) {
      console.error(
        "[db] Failed to ensure agent views:",
        err instanceof Error ? err.message : err
      );
    }

    if (process.env.DEMO_MODE === "true") {
      try {
        const { seedDemoData } = await import("./lib/demo/seed");
        await seedDemoData();
      } catch (err) {
        console.error(
          "[demo] Seed error:",
          err instanceof Error ? err.message : err
        );
      }
    } else {
      // Start background scheduler: daily Plaid sync + weekly digest
      try {
        const { startScheduler } = await import("./lib/scheduler");
        startScheduler();
      } catch (err) {
        console.error(
          "[scheduler] Failed to start:",
          err instanceof Error ? err.message : err
        );
      }
    }
  }
}
