/**
 * Health check endpoint for container orchestration, load balancers, and uptime monitors.
 * Returns 200 when the app + DB are operational, 503 if the DB is unreachable.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const startedAt = Date.now();

export async function GET() {
  let dbOk = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch {
    // DB unreachable — return 503
  }

  const uptime = Math.floor((Date.now() - startedAt) / 1000);
  const status = dbOk ? "ok" : "degraded";

  return NextResponse.json(
    { status, db: dbOk, uptime },
    { status: dbOk ? 200 : 503 }
  );
}
