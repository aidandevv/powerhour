import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recurringItems } from "@/lib/db/schema";

export async function GET() {
  try {
    const items = await db.select().from(recurringItems);
    return NextResponse.json({ items });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch recurring items";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
