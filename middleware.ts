import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData } from "@/lib/auth/session";

const publicPaths = ["/login", "/api/auth/login", "/api/webhooks/plaid"];

// Simple in-memory rate limiter for Edge Runtime (no external deps)
const dataRateMap = new Map<string, { count: number; resetAt: number }>();
const DATA_RATE_LIMIT = 120; // requests per window
const DATA_RATE_WINDOW = 60_000; // 1 minute in ms

function checkDataRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = dataRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    dataRateMap.set(ip, { count: 1, resetAt: now + DATA_RATE_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= DATA_RATE_LIMIT;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.[a-zA-Z0-9]{2,5}$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Check session
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, {
    password: process.env.SESSION_SECRET!,
    cookieName: "finance_session",
  });

  if (!session.isLoggedIn) {
    // For API routes, return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // For pages, redirect to login
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Check session expiry (8 hours)
  if (session.loginTime) {
    const eightHours = 8 * 60 * 60 * 1000;
    if (Date.now() - session.loginTime > eightHours) {
      session.destroy();
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Session expired" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // Rate limit authenticated API requests (except auth and webhooks)
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/") && !pathname.startsWith("/api/webhooks/")) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkDataRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429 }
      );
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
