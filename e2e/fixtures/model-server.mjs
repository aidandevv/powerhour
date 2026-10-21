import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

// Deterministic OpenAI-compatible transport for integration and browser tests.
export function createModelServer() {
  const requests = [];
  const server = createServer(async (req, res) => {
    if (req.url === "/health") {
      res.end("ok");
      return;
    }
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
      res.writeHead(404).end();
      return;
    }

    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    requests.push(body);
    if (body.model === "smoke-error") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Test model unavailable" } }));
      return;
    }
    if (body.model === "smoke-slow") {
      req.socket.on("close", () => res.destroy());
      return;
    }

    const feature = body.model.replace("smoke-", "");
    const hasToolResult = body.messages.some((message) => message.role === "tool");
    const toolName = feature === "chat" ? "get_account_balances" : "savings_projection";
    const useTool = !hasToolResult && ["chat", "planner"].includes(feature);
    const toolArguments = feature === "chat" ? {} : { targetAmount: 1200, monthlyAmount: 100 };
    const content = feature === "goals"
      ? JSON.stringify({ goals: ["FOOD_AND_DRINK", "SHOPPING", "ENTERTAINMENT"].map((category) => ({
          category, categoryLabel: category, targetType: "cap", monthlyTarget: 100,
          baselineMonthlySpend: 150, rationale: "Reduce monthly discretionary spending.",
        })) })
      : feature === "digest" ? "Weekly test digest\n- Spending is within the test budget."
      : feature === "planner" ? "Your savings plan is ready."
      : "Local model response received.";
    const toolCall = {
      id: "call-smoke", type: "function",
      function: { name: toolName, arguments: JSON.stringify(toolArguments) },
    };
    const finishReason = useTool ? "tool_calls" : "stop";
    const base = { id: "completion-smoke", created: 1, model: body.model };

    if (body.stream) {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      const delta = useTool
        ? { role: "assistant", tool_calls: [{ index: 0, ...toolCall }] }
        : { role: "assistant", content };
      res.write(`data: ${JSON.stringify({ ...base, object: "chat.completion.chunk", choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`);
      res.write(`data: ${JSON.stringify({ ...base, object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: finishReason }] })}\n\n`);
      res.end("data: [DONE]\n\n");
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        ...base, object: "chat.completion",
        choices: [{ index: 0, message: { role: "assistant", content, ...(useTool ? { tool_calls: [toolCall] } : {}) }, finish_reason: finishReason }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      }));
    }
  });
  return { server, requests };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { server } = createModelServer();
  server.listen(Number(process.env.MODEL_TEST_PORT ?? 11436), "127.0.0.1");
}
