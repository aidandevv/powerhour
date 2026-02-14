import { NextResponse } from "next/server";
import { syncAllInstitutions } from "@/lib/plaid/sync";

export async function POST() {
  try {
    const results = await syncAllInstitutions();
    return NextResponse.json({ results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
