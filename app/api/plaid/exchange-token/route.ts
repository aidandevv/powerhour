import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exchangePublicToken } from "@/lib/plaid/link";
import { apiError } from "@/lib/api/error";
import { isDemoMode } from "@/lib/demo";
import { logAuditEvent } from "@/lib/audit-log";

const exchangeSchema = z.object({
  public_token: z.string().min(1),
});

export async function POST(req: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.json(
      { error: "Plaid is disabled in demo mode." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = exchangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "public_token is required" }, { status: 400 });
  }

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const institution = await exchangePublicToken(parsed.data.public_token);
    await logAuditEvent("institution_link", ip, { institutionId: institution.id, name: institution.institutionName });
    return NextResponse.json({ institution });
  } catch (error: unknown) {
    return apiError(error, "Failed to exchange token");
  }
}
