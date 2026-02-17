import { NextResponse } from "next/server";
import { createLinkToken } from "@/lib/plaid/link";
import { apiError } from "@/lib/api/error";
import { isDemoMode } from "@/lib/demo";

export async function POST() {
  if (isDemoMode()) {
    return NextResponse.json(
      { error: "Plaid is disabled in demo mode." },
      { status: 403 }
    );
  }

  try {
    const linkToken = await createLinkToken();
    return NextResponse.json({ link_token: linkToken });
  } catch (error: unknown) {
    return apiError(error, "Failed to create link token");
  }
}
