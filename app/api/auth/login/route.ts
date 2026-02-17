import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { checkLoginRateLimit } from "@/lib/auth/rate-limit";
import { getEffectivePasswordHash } from "@/lib/auth/password";
import { isDemoMode } from "@/lib/demo";
import { logAuditEvent } from "@/lib/audit-log";

const loginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // In demo mode, skip password verification entirely
  if (isDemoMode()) {
    const session = await getSession();
    session.isLoggedIn = true;
    session.loginTime = Date.now();
    await session.save();
    await logAuditEvent("login", ip, { mode: "demo" });
    return NextResponse.json({ success: true });
  }

  const rateLimit = await checkLoginRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Too many login attempts. Try again in ${rateLimit.retryAfterSeconds} seconds.` },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  const passwordHash = await getEffectivePasswordHash();
  if (!passwordHash) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const isValid = await bcrypt.compare(parsed.data.password, passwordHash);
  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid password" },
      { status: 401 }
    );
  }

  const session = await getSession();
  session.isLoggedIn = true;
  session.loginTime = Date.now();
  await session.save();

  await logAuditEvent("login", ip);
  return NextResponse.json({ success: true });
}
