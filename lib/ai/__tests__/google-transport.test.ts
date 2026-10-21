import { generateObject, generateText, stepCountIs, tool } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { getLanguageModel } from "../model";

const env = { GEMINI_API_KEY: "test-key" };

function response(parts: unknown[]) {
  return new Response(JSON.stringify({
    candidates: [{ content: { role: "model", parts }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
  }), { headers: { "Content-Type": "application/json" } });
}

afterEach(() => vi.unstubAllGlobals());

describe("Gemini pin transport compatibility", () => {
  it("replays Gemini 3 thought signatures with a tool result", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response([{
        functionCall: { name: "get_balance", args: {} },
        thoughtSignature: "dGVzdC1zaWduYXR1cmU=",
      }]))
      .mockResolvedValueOnce(response([{ text: "The synthetic balance is 125." }]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateText({
      model: getLanguageModel("chat", env),
      prompt: "Read the synthetic account balance.",
      tools: {
        get_balance: tool({
          inputSchema: z.object({}),
          execute: async () => ({ balance: 125 }),
        }),
      },
      stopWhen: stepCountIs(2),
      maxRetries: 0,
    });

    expect(result.text).toBe("The synthetic balance is 125.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [url] of fetchMock.mock.calls) {
      expect(String(url)).toBe(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent"
      );
    }
    const followUp = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(followUp.contents[1].parts[0]).toMatchObject({
      functionCall: { name: "get_balance", args: {} },
      thoughtSignature: "dGVzdC1zaWduYXR1cmU=",
    });
    expect(followUp.contents[2].parts[0].functionResponse).toMatchObject({
      name: "get_balance", response: { content: { balance: 125 } },
    });
  });

  it("requests and validates structured output using the pinned model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response([{ text: '{"monthlyTarget":100}' }]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateObject({
      model: getLanguageModel("goals", env),
      prompt: "Return a synthetic monthly target of 100.",
      schema: z.object({ monthlyTarget: z.number().positive() }),
      maxRetries: 0,
    });

    expect(result.object).toEqual({ monthlyTarget: 100 });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/models/gemini-3.5-flash-lite:generateContent");
    expect(JSON.parse(options.body).generationConfig).toMatchObject({
      responseMimeType: "application/json",
      responseSchema: { type: "object", required: ["monthlyTarget"] },
    });
  });
});
