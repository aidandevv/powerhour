import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exchangePublicToken } from "@/lib/plaid/link";

const exchangeSchema = z.object({
  public_token: z.string().min(1),
});

export async function POST(req: NextRequest) {
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
    const institution = await exchangePublicToken(parsed.data.public_token);
    return NextResponse.json({ institution });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to exchange token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
