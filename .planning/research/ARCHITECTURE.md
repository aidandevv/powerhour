# Architecture Research

**Domain:** AI agent integration — ReAct loop + streaming chat in existing Next.js 14 financial dashboard
**Researched:** 2026-02-13
**Confidence:** HIGH (existing codebase read directly; patterns verified against official docs and Gemini API reference)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                             │
│                                                                  │
│  ┌──────────────┐   ┌──────────────────┐   ┌────────────────┐  │
│  │  Dashboard   │   │   Chat Widget    │   │  PDF Download  │  │
│  │  (existing)  │   │ components/ai/   │   │   (trigger)    │  │
│  └──────┬───────┘   └────────┬─────────┘   └───────┬────────┘  │
│         │ SWR hooks          │ fetch + ReadableStream│ fetch     │
└─────────┼────────────────────┼──────────────────────┼───────────┘
          │                    │                       │
          ▼                    ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  NEXT.JS MIDDLEWARE (middleware.ts)               │
│        iron-session auth check — all /api/* routes blocked       │
└──────────────────┬──────────────────────────────────────────────┘
                   │
          ┌────────┴─────────────────────────┐
          ▼                                   ▼
┌─────────────────────────┐       ┌───────────────────────────────┐
│  Existing API Routes    │       │   New AI API Routes            │
│  app/api/accounts/      │       │   app/api/ai/chat/route.ts    │
│  app/api/transactions/  │       │   app/api/ai/report/route.ts  │
│  app/api/dashboard/     │       └──────────────┬────────────────┘
│  app/api/...            │                      │
└─────────┬───────────────┘                      │
          │                                      ▼
          │                         ┌────────────────────────────┐
          │                         │    Agent Orchestrator      │
          │                         │    lib/ai/agent.ts         │
          │                         │                            │
          │                         │  while (!done) {           │
          │                         │    llm.generateContent()   │
          │                         │    if (toolCall) runTool() │
          │                         │    stream(thought+answer)  │
          │                         │  }                         │
          │                         └────────┬───────────────────┘
          │                                  │
          │           ┌──────────────────────┼──────────────────────┐
          │           ▼                      ▼                      ▼
          │  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────┐
          │  │  Tool: spend-  │  │  Tool: balances │  │  Tool: trends    │
          │  │  ing_summary   │  │  _by_account    │  │  _over_period    │
          │  │  lib/ai/tools/ │  │  lib/ai/tools/  │  │  lib/ai/tools/   │
          └──►  (read-only DB)│  │  (read-only DB) │  │  (read-only DB)  │
             └────────┬───────┘  └────────┬────────┘  └────────┬─────────┘
                      └──────────────────┬┴─────────────────────┘
                                         ▼
                              ┌──────────────────────┐
                              │   Drizzle ORM / PG   │
                              │   lib/db/index.ts    │
                              │   (existing, shared) │
                              └──────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `ChatWidget` | Render conversation, send messages, consume SSE stream, display streaming tokens | React client component with `useState` + `fetch` + `ReadableStream` reader |
| `app/api/ai/chat/route.ts` | Authenticate request, invoke agent, pipe streaming response back to client | Next.js Route Handler returning `new Response(stream, { headers: SSE_HEADERS })` |
| `lib/ai/agent.ts` | Run the ReAct loop: call LLM, detect tool calls, execute tools, accumulate conversation, stream output | Pure TypeScript async function; no framework dependency |
| `lib/ai/tools/` | Execute individual read-only DB queries that the agent can invoke | Named tool functions accepting typed args, returning data objects |
| `lib/ai/prompt.ts` | Build the system prompt injected into every conversation | Template string with tool descriptions, date context, data format instructions |
| `lib/ai/stream.ts` | Wrap the `ReadableStream` controller with typed event helpers | `enqueueToken()`, `enqueueToolCall()`, `enqueueError()`, `close()` helpers |
| `app/api/ai/report/route.ts` | Generate PDF from agent-produced financial summary | Invoke agent (non-streaming), pass markdown output to PDF renderer, return binary |
| `lib/ai/pdf.ts` | Convert markdown or structured data into a PDF buffer | Wrapper around chosen PDF library (e.g., `@react-pdf/renderer` or `puppeteer`) |
| `components/ai/` | Chat bubble, typing indicator, tool-call badge UI | Isolated React components; no business logic |

---

## Recommended Project Structure

```
financial-project/
├── app/
│   └── api/
│       └── ai/
│           ├── chat/
│           │   └── route.ts          # POST — streaming chat endpoint
│           └── report/
│               └── route.ts          # POST — PDF generation endpoint
├── components/
│   └── ai/
│       ├── chat-widget.tsx           # Floating chat panel (client component)
│       ├── chat-message.tsx          # Individual message bubble
│       ├── tool-call-badge.tsx       # Shows which tool the agent used
│       └── typing-indicator.tsx      # Streaming "thinking" state
├── hooks/
│   └── use-chat.ts                   # Manages stream reading, message state
├── lib/
│   └── ai/
│       ├── agent.ts                  # ReAct loop orchestrator
│       ├── prompt.ts                 # System prompt builder
│       ├── stream.ts                 # ReadableStream helpers + SSE encoding
│       ├── pdf.ts                    # PDF generation wrapper
│       └── tools/
│           ├── index.ts              # Tool registry (array of tool definitions)
│           ├── spending-summary.ts   # Query spending by category/period
│           ├── account-balances.ts   # Query current balances per account
│           ├── transaction-list.ts   # Query recent transactions with filters
│           ├── net-worth-history.ts  # Query balance snapshots over time
│           └── recurring-items.ts    # Query detected recurring expenses
└── types/
    └── index.ts                      # Extend with AgentMessage, ToolCall types
```

### Structure Rationale

- **`lib/ai/`:** Keeps all agent logic in the existing `lib/` pattern — the codebase already organizes service code here (`lib/plaid/`, `lib/auth/`). This makes the agent a first-class service module.
- **`lib/ai/tools/`:** Each tool is its own file. This makes adding, removing, or testing tools independently trivial. The `index.ts` exports a typed registry array consumed by both the agent loop and the Gemini tool declaration builder.
- **`components/ai/`:** Chat UI is isolated from dashboard components — it lives in its own subdirectory to avoid polluting `components/dashboard/`.
- **`hooks/use-chat.ts`:** Follows the existing `hooks/` pattern. Manages stream lifecycle so components stay declarative.
- **`app/api/ai/`:** Follows existing route grouping. Two endpoints: `chat/` for streaming, `report/` for PDF.

---

## Architectural Patterns

### Pattern 1: ReAct Loop with Gemini Function Calling

**What:** The agent loop calls `generateContent` (or `generateContentStream`) with tool declarations. Gemini natively returns structured function calls when it decides to use a tool. The loop executes the tool, appends the result to conversation history, and calls Gemini again. This repeats until Gemini returns a final text answer with no function calls.

**When to use:** Always. This is the core of the feature. Do NOT use prompt-based parsing (parsing "Action: toolName" from raw text) — Gemini's native function calling is structured, typed, and more reliable.

**Trade-offs:** Requires maintaining conversation `contents[]` array manually across turns. Max iterations guard prevents infinite loops.

**Example:**
```typescript
// lib/ai/agent.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { toolDeclarations, executeToolByName } from "./tools/index";
import { buildSystemPrompt } from "./prompt";

export async function runAgent(
  userMessage: string,
  onToken: (token: string) => void,
  onToolCall: (name: string) => void
): Promise<void> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    systemInstruction: buildSystemPrompt(),
    tools: [{ functionDeclarations: toolDeclarations }],
  });

  const history: Content[] = [
    { role: "user", parts: [{ text: userMessage }] },
  ];

  const MAX_ITERATIONS = 6;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const result = await model.generateContent({ contents: history });
    const response = result.response;

    // Tool call requested
    const calls = response.functionCalls();
    if (calls && calls.length > 0) {
      history.push({ role: "model", parts: response.candidates![0].content.parts });

      const functionResponseParts = await Promise.all(
        calls.map(async (call) => {
          onToolCall(call.name);
          const toolResult = await executeToolByName(call.name, call.args);
          return {
            functionResponse: { name: call.name, response: toolResult },
          };
        })
      );
      history.push({ role: "user", parts: functionResponseParts });
      continue;
    }

    // Final answer — stream tokens
    const text = response.text();
    // Stream character-by-character or word-by-word for perceived responsiveness
    for (const word of text.split(" ")) {
      onToken(word + " ");
      await new Promise((r) => setTimeout(r, 0)); // yield to event loop
    }
    return;
  }
  onToken("[Agent reached max iterations]");
}
```

### Pattern 2: SSE Streaming via ReadableStream in Route Handler

**What:** The chat route handler creates a `ReadableStream`, starts the agent in the background (without `await`ing in `start()`), and returns the stream immediately with SSE headers. The agent calls `controller.enqueue()` on each token and `controller.close()` when done.

**When to use:** The chat endpoint. Do not use WebSockets — SSE is simpler, works over HTTP/2, and is sufficient for unidirectional token streaming.

**Trade-offs:** SSE is unidirectional (server to client). The client sends one HTTP POST per message, then reads the response stream. This is the correct model for a chat where requests are discrete.

**Example:**
```typescript
// app/api/ai/chat/route.ts
import { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData } from "@/lib/auth/session";
import { runAgent } from "@/lib/ai/agent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

export async function POST(req: NextRequest) {
  // Auth — reuse iron-session pattern
  const res = new Response();
  const session = await getIronSession<SessionData>(req, res, {
    password: process.env.SESSION_SECRET!,
    cookieName: "finance_session",
  });
  if (!session.isLoggedIn) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message } = await req.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Do NOT await — return stream immediately
      runAgent(
        message,
        (token) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "token", token })}\n\n`));
        },
        (toolName) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "tool", name: toolName })}\n\n`));
        }
      )
        .catch((err) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`));
        })
        .finally(() => {
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        });
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
```

### Pattern 3: Tool as Typed Read-Only DB Query

**What:** Each agent tool is a file that exports (a) a `FunctionDeclaration` object for Gemini and (b) an `execute(args)` function that runs a Drizzle ORM query. The `tools/index.ts` registry aggregates both into parallel arrays so the agent loop can call `toolDeclarations` for Gemini and `executeToolByName` for dispatch.

**When to use:** For every data source the agent can access. Never give the agent write access to the DB.

**Trade-offs:** Two export shapes per tool (declaration + executor) adds a little boilerplate, but keeps each tool completely self-contained and testable in isolation.

**Example:**
```typescript
// lib/ai/tools/spending-summary.ts
import { FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { sql, gte, lte } from "drizzle-orm";

export const declaration: FunctionDeclaration = {
  name: "get_spending_summary",
  description:
    "Returns total spending grouped by category for a date range. Use when the user asks about spending habits, categories, or totals for a period.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      startDate: { type: SchemaType.STRING, description: "ISO date YYYY-MM-DD" },
      endDate:   { type: SchemaType.STRING, description: "ISO date YYYY-MM-DD" },
    },
    required: ["startDate", "endDate"],
  },
};

export async function execute(args: { startDate: string; endDate: string }) {
  const rows = await db
    .select({
      category: transactions.category,
      total: sql<number>`sum(amount)`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .where(
      sql`${transactions.date} >= ${args.startDate}
      AND ${transactions.date} <= ${args.endDate}
      AND ${transactions.pending} = false`
    )
    .groupBy(transactions.category)
    .orderBy(sql`sum(amount) desc`);

  return { categories: rows };
}
```

```typescript
// lib/ai/tools/index.ts — the registry
import { declaration as spendingDecl, execute as spendingExec } from "./spending-summary";
import { declaration as balancesDecl, execute as balancesExec } from "./account-balances";
// ... other tools

export const toolDeclarations = [spendingDecl, balancesDecl, /* ... */];

const executors: Record<string, (args: any) => Promise<any>> = {
  get_spending_summary: spendingExec,
  get_account_balances: balancesExec,
  // ...
};

export async function executeToolByName(name: string, args: unknown) {
  const fn = executors[name];
  if (!fn) throw new Error(`Unknown tool: ${name}`);
  return fn(args);
}
```

### Pattern 4: Client-Side Stream Reader Hook

**What:** `use-chat.ts` manages the full lifecycle: POST the user message, read the SSE stream chunk-by-chunk, parse the JSON events, and update React state incrementally.

**When to use:** In the ChatWidget component. This isolates all stream-reading complexity from the UI.

**Example:**
```typescript
// hooks/use-chat.ts
export function useChat() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  async function sendMessage(userText: string) {
    setIsStreaming(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userText },
      { role: "assistant", content: "", toolCalls: [] },
    ]);

    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText }),
    });

    const reader = response.body!
      .pipeThrough(new TextDecoderStream())
      .getReader();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      // Parse SSE lines
      for (const line of value.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") { setIsStreaming(false); break; }

        const event = JSON.parse(data);
        setMessages((prev) => {
          const last = { ...prev[prev.length - 1] };
          if (event.type === "token") last.content += event.token;
          if (event.type === "tool") last.toolCalls = [...(last.toolCalls ?? []), event.name];
          return [...prev.slice(0, -1), last];
        });
      }
    }
  }

  return { messages, isStreaming, sendMessage };
}
```

---

## Data Flow

### ReAct Loop Request Flow

```
User types message in ChatWidget
    │
    ▼
useChat.sendMessage(text)
    │  POST /api/ai/chat  { message }
    ▼
middleware.ts — iron-session auth check
    │  401 if no valid session
    ▼
app/api/ai/chat/route.ts
    │  Creates ReadableStream, starts runAgent() in background
    │  Returns Response(stream) with SSE headers immediately
    ▼
lib/ai/agent.ts — ReAct iteration loop
    │
    ├─[1] Builds contents[] with system prompt + user message
    │
    ├─[2] model.generateContent({ contents, tools })
    │        │
    │        ▼
    │     Gemini 2.5 Flash-Lite API (HTTPS)
    │        │
    │        ▼ response
    │
    ├─[3a] response.functionCalls() → tool requested
    │        │
    │        ├─ onToolCall(name) → enqueue SSE { type:"tool", name }
    │        │
    │        ├─ executeToolByName(name, args)
    │        │       │
    │        │       ▼
    │        │   lib/ai/tools/*.ts
    │        │       │  Drizzle ORM read-only SELECT
    │        │       ▼
    │        │   PostgreSQL (existing DB)
    │        │       │
    │        │       ▼ rows
    │        │   tool returns { ... data ... }
    │        │
    │        ├─ Append model content + functionResponse to contents[]
    │        └─ Loop back to [2]
    │
    └─[3b] response.text() → final answer
             │
             ├─ onToken(word) → enqueue SSE { type:"token", token }
             │     ↑ repeated per word
             │
             └─ controller.close() → SSE [DONE]

ReadableStream events arrive in browser
    │  pipeThrough(TextDecoderStream).getReader()
    ▼
useChat state updates: messages[last].content += token
    │
    ▼
ChatWidget re-renders with incremental text
```

### PDF Report Flow

```
User clicks "Download Report"
    │  POST /api/ai/report  { period }
    ▼
app/api/ai/report/route.ts
    │  Runs agent non-streaming (full completion)
    │  Passes structured output to lib/ai/pdf.ts
    ▼
lib/ai/pdf.ts
    │  Renders PDF buffer
    ▼
Response(buffer, { "Content-Type": "application/pdf" })
    │
    ▼
Browser triggers file download
```

---

## Build Order (Dependencies)

The order below reflects hard dependencies: each item requires the previous to be functional before it can be built or tested.

```
Phase 1 — Foundation (no dependencies on AI yet)
  1. lib/ai/tools/*.ts          Read-only DB query functions; testable standalone
  2. lib/ai/tools/index.ts      Tool registry; depends on tool files

Phase 2 — Agent Core
  3. lib/ai/prompt.ts           System prompt builder; depends on tool list for descriptions
  4. lib/ai/agent.ts            ReAct loop; depends on Gemini SDK, tools, prompt
  5. lib/ai/stream.ts           SSE helpers; depends on nothing (utility)

Phase 3 — API Layer
  6. app/api/ai/chat/route.ts   Streaming endpoint; depends on agent.ts + stream.ts + auth
  7. Test via curl/Postman before any UI work

Phase 4 — Chat UI
  8. hooks/use-chat.ts          Stream reader hook; depends on chat route
  9. components/ai/chat-*.tsx   Chat UI components; depends on hook
 10. Wire ChatWidget into dashboard layout

Phase 5 — PDF Reports
 11. lib/ai/pdf.ts              PDF renderer; can be built in parallel with Phase 4
 12. app/api/ai/report/route.ts PDF endpoint; depends on agent.ts + pdf.ts
 13. PDF download button in UI
```

---

## Anti-Patterns

### Anti-Pattern 1: Prompt-Parsing ReAct Instead of Native Function Calling

**What people do:** Ask Gemini to emit text like `"Action: get_spending_summary\nAction Input: {..."` then regex-parse it to decide which tool to call.

**Why it's wrong:** Fragile. Model output format is not guaranteed. A single formatting deviation breaks the loop. Gemini's native function calling returns typed, structured `functionCalls()` — there is no reason to avoid it.

**Do this instead:** Pass `tools: [{ functionDeclarations: [...] }]` in every `generateContent` call and check `response.functionCalls()`.

### Anti-Pattern 2: Awaiting the Agent in ReadableStream.start()

**What people do:**
```typescript
const stream = new ReadableStream({
  async start(controller) {
    await runAgent(...); // blocks — stream response is never sent until done
  }
});
return new Response(stream, { headers: SSE_HEADERS });
```

**Why it's wrong:** In Node.js, `await`ing inside `start()` delays the `Response` from being returned to the HTTP layer. The client sees nothing until the agent completes, defeating streaming.

**Do this instead:** Fire the async work without `await` inside `start()`, let it run in the background, and return the `Response` immediately. Use `.finally(() => controller.close())`.

### Anti-Pattern 3: Giving the Agent Write Access to the DB

**What people do:** Include tools like `create_transaction`, `update_account`, or pass the full Drizzle `db` client to the agent.

**Why it's wrong:** LLMs hallucinate. A financial agent with write access can corrupt real account data based on a misunderstood query. This is a single-user personal dashboard — the risk-to-reward ratio is completely wrong.

**Do this instead:** Every tool in `lib/ai/tools/` performs only `SELECT` queries. The tool registry is the only interface between the agent and the DB. Code review every tool addition for write operations.

### Anti-Pattern 4: Storing Conversation History in Client State Only

**What people do:** Keep the full `contents[]` conversation array only in React state, send it in its entirety on every message, and let it grow unbounded.

**Why it's wrong:** Large context arrays balloon request payload size. With Gemini's 1M token context limit, this is not a safety limit issue — it is a latency and cost issue. Sending 50 past messages on every request is wasteful.

**Do this instead:** Keep conversation history server-side in memory (or a simple table) keyed by session. Send only the new user message per request. Implement a sliding window of the last N turns. For this single-user app, an in-memory Map keyed by session cookie is sufficient.

### Anti-Pattern 5: Not Scoping the System Prompt to Read-Only

**What people do:** Write a generic system prompt like "You are a helpful financial assistant."

**Why it's wrong:** The model may attempt to imply actions it cannot take, confusing the user, or it may attempt to describe non-existent capabilities.

**Do this instead:** The system prompt must state explicitly: "You have access to the following read-only tools. You cannot modify any data. You cannot access external financial services. Today's date is [date]." Include tool descriptions inline so the model understands when to use each.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Gemini 2.5 Flash-Lite | `@google/generative-ai` SDK, HTTPS calls from server only | API key in env var `GEMINI_API_KEY`. Never expose to client. |
| PostgreSQL (existing) | Drizzle ORM — shared `lib/db/index.ts` client | Agent tools reuse the existing DB client. No new connection pool needed. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `ChatWidget` ↔ `/api/ai/chat` | HTTP POST + SSE ReadableStream | One request per user message; response is a streaming SSE body |
| `agent.ts` ↔ `tools/index.ts` | Direct function call via `executeToolByName` | Synchronous dispatch, tools are async |
| `agent.ts` ↔ Gemini API | `@google/generative-ai` SDK — HTTPS | Network call; needs timeout guard for production |
| `tools/*.ts` ↔ `lib/db/index.ts` | Drizzle ORM — shared client import | Read-only. Tools import `db` and `schema` directly — same pattern as existing API routes |
| `middleware.ts` ↔ `/api/ai/*` | iron-session check — automatic via matcher | No special config needed; new routes under `/api/` are protected by default |

### Confidence on Key Decisions

| Decision | Confidence | Basis |
|----------|------------|-------|
| Gemini function calling via `@google/generative-ai` | HIGH | Official Gemini API docs (ai.google.dev/gemini-api/docs/function-calling) |
| SSE via `ReadableStream` in Next.js 14 Route Handler | HIGH | Official Next.js docs + verified Upstash tutorial |
| `dynamic = 'force-dynamic'` + `runtime = 'nodejs'` required | HIGH | Next.js docs; without these, route may be statically cached |
| ReAct loop without LangChain | HIGH | Pattern is well-documented; Gemini function calling makes it straightforward |
| Auth: existing `middleware.ts` covers new `/api/ai/*` routes automatically | HIGH | Read `middleware.ts` directly — matcher covers all `/api/*` |
| Tool isolation as read-only SELECT | HIGH | Security requirement; no technical barrier |
| In-memory conversation history for single-user | MEDIUM | Appropriate for single-user app; loses history on server restart. If persistence required, add a `chat_sessions` DB table |

---

## Scalability Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users (personal dashboard) | Current design is correct — in-memory history, single Node process, no queue |
| Multi-user (future) | Move conversation history to DB table; add user_id scoping to all tools; move agent to background queue to avoid tying up HTTP request threads |
| High agent concurrency | Agent loop is CPU-light but network-heavy (Gemini API calls). Current architecture handles multiple simultaneous chats without issue — bottleneck is Gemini API rate limits, not this app |

---

## Sources

- Gemini API Function Calling docs: https://ai.google.dev/gemini-api/docs/function-calling
- Gemini 2.5 Flash-Lite model capabilities: https://ai.google.dev/gemini-api/docs/models
- Next.js App Router Route Handlers: https://nextjs.org/docs/app/api-reference/file-conventions/route
- SSE in Next.js 14 — Upstash tutorial: https://upstash.com/blog/sse-streaming-llm-responses
- SSE in Next.js 14 — Pedro Alonso: https://www.pedroalonso.net/blog/sse-nextjs-real-time-notifications/
- ReAct pattern from scratch: https://www.dailydoseofds.com/ai-agents-crash-course-part-10-with-implementation/
- ReAct architecture overview: https://www.emergentmind.com/topics/react-based-agent-architecture
- Existing codebase: `lib/db/schema.ts`, `middleware.ts`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`

---

*Architecture research for: AI agent + PDF reports milestone on Next.js 14 financial dashboard*
*Researched: 2026-02-13*
