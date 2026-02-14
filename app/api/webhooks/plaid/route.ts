import { NextRequest, NextResponse } from "next/server";
import { verifyPlaidWebhook, handleWebhook } from "@/lib/plaid/webhooks";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // Verify webhook signature
    const isValid = await verifyPlaidWebhook(body, headers);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    const webhookBody = JSON.parse(body);

    // Process webhook asynchronously — respond immediately
    handleWebhook(webhookBody).catch((err) => {
      console.error("Webhook processing error:", err);
    });

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
