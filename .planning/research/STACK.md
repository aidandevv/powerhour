# Stack Research

**Domain:** AI agent features added to existing Next.js 14 financial dashboard
**Researched:** 2026-02-13
**Confidence:** HIGH (all key choices verified via official docs + multiple sources)

---

## Context: What Already Exists (Do Not Re-research)

The project has: Next.js 14 App Router, TypeScript, Drizzle ORM, PostgreSQL, Tailwind CSS, Radix UI, Zod, SWR, iron-session, rate-limiter-flexible. This research only covers the **new** additions.

---

## Recommended Stack

### Core Technologies (New Additions Only)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `ai` (Vercel AI SDK) | `^6.0.86` | Agent orchestration, streaming, tool calling | Single package handles the ReAct loop (`streamText` + `maxSteps`), streaming transport to Next.js route handlers, and UI hooks. Provider-agnostic so Gemini can be swapped later. Has `ToolLoopAgent` for structured agent loops in v6. Fully compatible with Next.js 14 App Router. |
| `@ai-sdk/google` | `^3.0.26` | Gemini provider adapter for Vercel AI SDK | Provides `google('gemini-2.5-flash-lite')` model factory. Confirmed to support `gemini-2.5-flash-lite` (stable GA) with tool usage, tool streaming, image input, Google Search grounding. Version 3.x ships alongside AI SDK 6. |
| `@ai-sdk/react` | `^3.0.39` | `useChat` hook for streaming chat UI | Manages client-side message state, streaming display, and optimistic updates. Decouples agent server logic from chat widget UI. Ships with AI SDK 6 as a sub-package. |
| `pdfkit` | `^0.17.2` | Server-side PDF generation | Pure Node.js stream-based PDF library. Works reliably in Next.js 14 App Router route handlers (no browser dependency, no SSR conflict). Outputs a `Buffer` that `NextResponse` returns directly. Actively maintained (v0.17.2, 5 months ago). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | already installed `^3.25.76` | Tool input schema validation | Define agent tool parameter schemas. AI SDK tools require Zod schemas natively — no additional install needed. |
| `@types/pdfkit` | `^0.13.x` | TypeScript types for PDFKit | Install as dev dep alongside pdfkit for full type coverage. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `npx @ai-sdk/devtools` | Debug agent LLM calls and tool steps | Launches local UI at `localhost:4983`. Run during development only; do not deploy. Available in AI SDK 6. |

---

## Installation

```bash
# Core AI agent + streaming
npm install ai @ai-sdk/google @ai-sdk/react

# PDF report generation
npm install pdfkit

# TypeScript types for pdfkit (dev only)
npm install -D @types/pdfkit
```

**Note:** `zod` is already installed. Do not reinstall.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@ai-sdk/google` (Vercel AI SDK provider) | `@google/genai` (Google's native SDK) | Use `@google/genai` directly only if you need Gemini-specific features not exposed through the Vercel AI SDK abstraction (e.g., Gemini Live API, native grounding, file uploads). For this project the abstraction is a net win: streaming-to-Next.js, tool calling, and `useChat` all work out of the box. |
| `pdfkit` | `@react-pdf/renderer` | Use `@react-pdf/renderer` only if you need pixel-perfect React-component-driven PDF layout (branded marketing docs). It has known, documented issues with Next.js 13+ App Router server-side rendering (GitHub issues #2356, #2460). Avoid for this project. |
| `pdfkit` | Puppeteer/Playwright (headless Chrome) | Use only if you need to capture a rendered web page as PDF (screenshot fidelity). Adds ~150MB+ to bundle, requires a Chromium binary, and has high memory overhead in serverless. Overkill for text/data reports. |
| `ai` v6 (Vercel AI SDK) | LangChain.js | The constraint is "no LangChain." LangChain adds ~50+ transitive dependencies, is significantly heavier, and the abstractions are opinionated in ways that fight Next.js streaming patterns. AI SDK v6 provides first-class `ToolLoopAgent` without the overhead. |
| `ai` v6 (Vercel AI SDK) | Hand-rolled fetch loop | Building a raw fetch → parse → re-submit loop from scratch is viable and educational, but you'd be reimplementing streaming SSE parsing, error recovery, and multi-step tool orchestration that AI SDK already handles. The constraint says "from scratch" in the sense of no LangChain — AI SDK is the right level of abstraction for Next.js. |
| `@ai-sdk/react` `useChat` | Custom streaming fetch hook | Only if you need non-chat streaming patterns (e.g., form submission that returns a stream). `useChat` handles all state for this project's chat widget. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@google/generative-ai` | **OFFICIALLY DEPRECATED** by Google as of 2025. The repository is renamed to `deprecated-generative-ai-js`. All new development should use `@google/genai` or the `@ai-sdk/google` provider. | `@ai-sdk/google` (via Vercel AI SDK) |
| `langchain` / `@langchain/google-genai` | Excluded by project constraint ("no LangChain"). Adds enormous dependency tree, complex abstractions that fight Next.js streaming, and slower release cycle for new Gemini features. | `ai` + `@ai-sdk/google` |
| `@react-pdf/renderer` | Known App Router SSR incompatibilities (issues #2356, #2460 on GitHub). Relies on browser APIs; needs `'use client'` directive, which prevents server-side PDF generation in route handlers. | `pdfkit` |
| `openai` or other provider packages | Unnecessary: `@ai-sdk/google` is the provider. Installing multiple provider SDKs adds confusion and bloat. | `@ai-sdk/google` only |
| Edge Runtime for AI route handlers | Gemini function calling + multi-step tool loops require Node.js runtime (Edge has no `Buffer`, limited compute time). Must use `export const runtime = 'nodejs'` in route handlers. | Node.js runtime (default) |

---

## Stack Patterns by Variant

**If you want the ReAct loop via Vercel AI SDK (recommended):**
- Use `streamText({ model, tools, maxSteps: 10, messages })` in a Next.js App Router POST route handler
- `maxSteps` drives the ReAct loop: model calls tool → tool result returned → model reasons again → repeat
- Return `result.toUIMessageStreamResponse()` from the route handler for `useChat` compatibility
- Set `export const dynamic = 'force-dynamic'` on the route

**If you want a lower-level manual ReAct loop (educational/alternative):**
- Use `@google/genai` directly with `ai.models.generateContent()` + manual tool dispatch loop
- More verbose, but gives full control over Gemini-specific features (grounding, thinking budgets)
- Skip `@ai-sdk/google` and `@ai-sdk/react` in this case; build your own SSE streaming with `ReadableStream`

**For PDF generation:**
- Create a `GET /api/reports/[type]/route.ts` handler (Node.js runtime)
- Use PDFKit to stream into a `Buffer`, return via `new NextResponse(buffer, { headers: { 'Content-Type': 'application/pdf' } })`
- AI summary text is generated by the agent first, then injected into the PDF template

**For the chat widget UI:**
- `useChat` hook from `@ai-sdk/react` pointed at `/api/agent`
- Render streamed text with standard React state — no third-party chat UI library needed (project uses Radix UI already)

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `ai@^6.0.86` | Next.js 14 App Router | Verified: AI SDK 6 supports Next.js 14. Route handler pattern uses `streamText` + `toUIMessageStreamResponse()`. |
| `@ai-sdk/google@^3.0.26` | `ai@^6.0.x` | `@ai-sdk/google` v3.x is the companion provider for AI SDK 6. Do not mix with `ai@4.x` or `ai@5.x`. |
| `@ai-sdk/react@^3.0.39` | React 18.x (existing) | Compatible with React 18 which is already installed. |
| `pdfkit@^0.17.2` | Node.js 18+ | Project already has Node.js types (`@types/node@^22`). No conflicts. |
| `gemini-2.5-flash-lite` model | `@ai-sdk/google@^3.0.26` | Model string `'gemini-2.5-flash-lite'` is listed in `@ai-sdk/google` provider docs. GA (stable) as of July 2025. |
| Existing `zod@^3.25.76` | `ai@^6.0.86` | AI SDK uses Zod for tool schemas. The existing version is compatible — no upgrade needed. |

---

## Key Architecture Notes for Roadmap

1. **Agent is read-only by constraint.** All tools query the DB via Drizzle (existing schema) — no write tools. This simplifies security review significantly.

2. **Session-scoped context window.** Gemini 2.5 Flash Lite has a 1M token context window — no need for vector embeddings or RAG for this project's financial data volume.

3. **No persistent agent state.** Each chat session is ephemeral (messages in React state via `useChat`). If conversation history persistence is added later, the existing PostgreSQL/Drizzle setup handles it.

4. **Streaming requires Node.js runtime.** All AI route handlers must avoid Edge Runtime. The existing project has no Edge Runtime constraints, so no conflict.

5. **Rate limiting already exists.** The project has `rate-limiter-flexible` installed — apply existing rate limiting to the `/api/agent` route.

6. **`"type": "commonjs"` in package.json.** Both `ai` (ESM) and `pdfkit` (CJS-compatible) work with Next.js 14's module handling. Next.js internally transpiles — no changes to `package.json` type are needed.

---

## Sources

- `@ai-sdk/google` provider docs: https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai — HIGH confidence (official docs). Confirms `gemini-2.5-flash-lite` support, `@ai-sdk/google` v3.0.26.
- Vercel AI SDK 6 announcement: https://vercel.com/blog/ai-sdk-6 — HIGH confidence. Confirms `ToolLoopAgent`, `maxSteps`, streaming patterns.
- AI SDK 6 migration guide: https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0 — HIGH confidence. Breaking changes from v4/v5 documented.
- AI SDK agents docs: https://ai-sdk.dev/docs/foundations/agents — HIGH confidence. `ToolLoopAgent`, `stepCountIs()` confirmed.
- AI SDK Next.js App Router getting started: https://ai-sdk.dev/docs/getting-started/nextjs-app-router — HIGH confidence. `streamText` + `toUIMessageStreamResponse()` pattern confirmed.
- Google Gemini 2.5 Flash Lite GA blog: https://developers.googleblog.com/en/gemini-25-flash-lite-is-now-stable-and-generally-available/ — HIGH confidence. Model ID `gemini-2.5-flash-lite`, pricing, capabilities.
- Google Gemini models page: https://ai.google.dev/gemini-api/docs/models — HIGH confidence. Model ID, capabilities (function calling, thinking, 1M context).
- `@google/genai` GitHub: https://github.com/googleapis/js-genai — HIGH confidence. Streaming, function calling confirmed. `@google/generative-ai` deprecated.
- `@google/generative-ai` deprecated: https://github.com/google-gemini/deprecated-generative-ai-js — HIGH confidence. Deprecated status confirmed.
- PDFKit npm: https://www.npmjs.com/package/pdfkit — HIGH confidence. v0.17.2, 927 dependents, actively maintained.
- `@react-pdf/renderer` App Router issues: https://github.com/diegomura/react-pdf/issues/2460 — HIGH confidence (official GitHub issue). App Router SSR incompatibility documented.
- `ai` npm package (version 6.0.86): WebSearch result, multiple sources agree — HIGH confidence.
- `@ai-sdk/google` npm (version 3.0.26): WebSearch result, multiple sources agree — HIGH confidence.

---
*Stack research for: AI agent (ReAct + Gemini 2.5 Flash Lite) + PDF reports added to Next.js 14 financial dashboard*
*Researched: 2026-02-13*
