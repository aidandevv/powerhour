import { NextResponse } from "next/server";

export function apiError(error: unknown, fallback: string, status = 500) {
  const message =
    process.env.NODE_ENV === "production"
      ? fallback
      : error instanceof Error
        ? error.message
        : fallback;
  return NextResponse.json({ error: message }, { status });
}
