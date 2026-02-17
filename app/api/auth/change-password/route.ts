import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getEffectivePasswordHash } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { apiError } from "@/lib/api/error";
import { logAuditEvent } from "@/lib/audit-log";

const changeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = changeSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { currentPassword, newPassword } = parsed.data;

    const passwordHash = await getEffectivePasswordHash();
    if (!passwordHash) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const isValid = await bcrypt.compare(currentPassword, passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    await db
      .insert(userSettings)
      .values({
        id: "default",
        passwordHash: newHash,
      })
      .onConflictDoUpdate({
        target: userSettings.id,
        set: {
          passwordHash: newHash,
          updatedAt: new Date(),
        },
      });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    await logAuditEvent("password_change", ip);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return apiError(error, "Failed to change password");
  }
}
