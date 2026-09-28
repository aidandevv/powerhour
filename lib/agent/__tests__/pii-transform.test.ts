import { describe, expect, it } from "vitest";
import { tool, type TextStreamPart } from "ai";
import { z } from "zod";
import { PiiMasker } from "../pii-masker";
import {
  createPiiTransform,
  maskUserMessages,
  wrapToolsWithMasker,
} from "../pii-transform";

async function runTransform(
  parts: Array<TextStreamPart<Record<string, never>>>,
  masker: PiiMasker
) {
  const transform = createPiiTransform<Record<string, never>>(masker)({
    tools: {},
    stopStream: () => {},
  });
  const stream = new ReadableStream<TextStreamPart<Record<string, never>>>({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(part);
      }
      controller.close();
    },
  }).pipeThrough(transform);

  const reader = stream.getReader();
  const output: Array<TextStreamPart<Record<string, never>>> = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    output.push(value);
  }

  return output;
}

describe("pii-transform", () => {
  it("masks user text parts before model conversion", () => {
    const masker = new PiiMasker();
    masker.registerMerchant("Starbucks");

    const messages = maskUserMessages(
      [
        {
          id: "u1",
          role: "user",
          parts: [{ type: "text", text: "How much did I spend at Starbucks?" }],
        },
      ],
      masker
    );

    expect(messages[0].parts).toEqual([
      { type: "text", text: "How much did I spend at Merchant-1?" },
    ]);
  });

  it("unmasks configured tool inputs before execution", async () => {
    const masker = new PiiMasker();
    masker.registerMerchant("Starbucks");

    let received: unknown;
    const tools = wrapToolsWithMasker(
      {
        search_transactions: tool({
          inputSchema: z.object({
            query: z.string(),
          }),
          execute: async (input: unknown) => {
            received = input;
            return { ok: true };
          },
        }),
      },
      masker
    );

    await tools.search_transactions.execute?.({ query: "Merchant-1" }, undefined as never);

    expect(received).toEqual({ query: "Starbucks" });
  });

  it("masks tool results before they continue through the stream", async () => {
    const masker = new PiiMasker();
    masker.registerMerchant("Starbucks");

    const output = await runTransform(
      [
        {
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "search_transactions",
          input: { query: "Starbucks" },
          output: { merchantName: "Starbucks", amount: 12.5 },
        } as TextStreamPart<Record<string, never>>,
      ],
      masker
    );

    expect(output).toEqual([
      {
        type: "tool-result",
        toolCallId: "call-1",
        toolName: "search_transactions",
        input: { query: "Starbucks" },
        output: { merchantName: "Merchant-1", amount: 12.5 },
      },
    ]);
  });

  it("buffers split aliases across text chunks before unmasking", async () => {
    const masker = new PiiMasker();
    masker.registerMerchant("Starbucks");

    const output = await runTransform(
      [
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", text: "You spent $25 at Merch" },
        { type: "text-delta", id: "t1", text: "ant-1 this week." },
        { type: "text-end", id: "t1" },
      ],
      masker
    );

    expect(output).toEqual([
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", text: "You spent $25 at " },
      { type: "text-delta", id: "t1", text: "Starbucks this week." },
      { type: "text-end", id: "t1" },
    ]);
  });
});
