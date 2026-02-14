import { NextResponse } from "next/server";
import { getSession, isSessionExpired } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();

  if (!session.isLoggedIn || isSessionExpired(session)) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({ authenticated: true });
}
