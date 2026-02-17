import { NextRequest, NextResponse } from "next/server";
import { syncInstitution } from "@/lib/plaid/sync";
import { apiError } from "@/lib/api/error";

export async function POST(
  _req: NextRequest,
  { params }: { params: { institutionId: string } }
) {
  try {
    await syncInstitution(params.institutionId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return apiError(error, "Sync failed");
  }
}
