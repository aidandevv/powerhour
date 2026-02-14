import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export interface SessionData {
  isLoggedIn: boolean;
  loginTime?: number;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "finance_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "strict" as const,
    maxAge: 8 * 60 * 60, // 8 hours
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  return session;
}

export async function getSessionFromRequest(
  req: NextRequest,
  res: NextResponse
): Promise<IronSession<SessionData>> {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  return session;
}

export function isSessionExpired(session: SessionData): boolean {
  if (!session.loginTime) return true;
  const eightHours = 8 * 60 * 60 * 1000;
  return Date.now() - session.loginTime > eightHours;
}
