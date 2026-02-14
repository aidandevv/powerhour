import { NextResponse } from "next/server";
import { createLinkToken } from "@/lib/plaid/link";

export async function POST() {
  try {
    const linkToken = await createLinkToken();
    return NextResponse.json({ link_token: linkToken });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create link token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
