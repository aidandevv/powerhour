import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";

/** Get the effective password hash: DB first, then env fallback */
export async function getEffectivePasswordHash(): Promise<string | null> {
  const [row] = await db
    .select({ passwordHash: userSettings.passwordHash })
    .from(userSettings)
    .where(eq(userSettings.id, "default"))
    .limit(1);

  if (row?.passwordHash) return row.passwordHash;
  return process.env.DASHBOARD_PASSWORD_HASH ?? null;
}
