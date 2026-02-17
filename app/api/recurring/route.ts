import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recurringItems } from "@/lib/db/schema";
import { decryptField } from "@/lib/crypto-fields";
import { apiError } from "@/lib/api/error";

export async function GET() {
  try {
    const items = await db.select().from(recurringItems);
    const decrypted = items.map((item) => ({
      ...item,
      name: decryptField(item.name) ?? item.name,
      merchantName: decryptField(item.merchantName),
    }));
    return NextResponse.json({ items: decrypted });
  } catch (error: unknown) {
    return apiError(error, "Failed to fetch recurring items");
  }
}
