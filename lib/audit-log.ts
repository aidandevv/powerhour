/**
 * Audit log — records sensitive actions to the DB for compliance and security review.
 * Failures are intentionally swallowed so they never break the primary action.
 */
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

export type AuditAction =
  | "login"
  | "logout"
  | "password_change"
  | "institution_link"
  | "institution_delete"
  | "report_download";

export async function logAuditEvent(
  action: AuditAction,
  ip?: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await db.insert(auditLog).values({
      action,
      ip: ip ?? null,
      metadata: metadata ?? null,
    });
  } catch (err) {
    // Audit log failures must never surface to the caller
    console.error("[audit] Failed to write event:", action, err instanceof Error ? err.message : err);
  }
}
