import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateInstitutionAccessToken } from "@/lib/plaid/link";
import { apiError } from "@/lib/api/error";

const schema = z.object({
  public_token: z.string().min(1),
  institution_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "public_token and institution_id are required" },
      { status: 400 }
    );
  }

  try {
    await updateInstitutionAccessToken(
      parsed.data.institution_id,
      parsed.data.public_token
    );
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return apiError(error, "Failed to complete relink");
  }
}
