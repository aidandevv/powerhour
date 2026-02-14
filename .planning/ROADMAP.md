# Roadmap: Financial Dashboard AI Agent & Reports

## Overview

This roadmap adds an AI conversational agent and PDF report generation to an existing Next.js 14 financial dashboard. The existing dashboard (Plaid integration, auth, transactions, balances) is the foundation — all new work layers on top of it. Phases execute in dependency order: security controls and data tools first, then the agent executor, then the chat UI, then PDF reports.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Security Foundation + Agent Tools** - Establish security controls and build all read-only DB query tools the agent will use
- [ ] **Phase 2: ReAct Agent Core + Streaming Endpoint** - Build the agent executor and streaming API endpoint
- [ ] **Phase 3: Chat Widget UI** - Integrate the chat interface into the dashboard
- [ ] **Phase 4: PDF Report Generation** - Add AI-narrated PDF reports via dashboard button and chat command

## Phase Details

### Phase 1: Security Foundation + Agent Tools
**Goal**: All agent security controls are in place and every read-only database tool the agent needs is callable and tested in isolation — before any AI code is written
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05
**Success Criteria** (what must be TRUE):
  1. A direct call to any agent tool function returns correctly structured data from the real database without exposing Plaid tokens, access tokens, or encrypted blobs in the result
  2. All agent API routes reject unauthenticated requests (401) and return no data
  3. Agent tool queries execute only SELECT statements — any attempt to call INSERT, UPDATE, or DELETE from tool code is not possible by design
  4. The Gemini API key is absent from all client-side bundles and never appears in network responses
  5. Each of the five tools (spending summary, account balances, transaction search, trend comparison, recurring expenses) returns a valid response when called directly with test parameters
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Security controls: Husky pre-commit hook, agent-facing DB views, .env.example audit
- [ ] 01-02-PLAN.md — Agent tools: TOOL-01 through TOOL-05 as isolated Drizzle query functions

### Phase 2: ReAct Agent Core + Streaming Endpoint
**Goal**: The ReAct agent executor drives a Gemini 2.5 Flash Lite loop that streams accurate, grounded financial answers — verifiable via curl before any UI exists
**Depends on**: Phase 1
**Requirements**: AGNT-01, AGNT-02, AGNT-05, AGNT-06, AGNT-07
**Success Criteria** (what must be TRUE):
  1. A curl request to the chat endpoint returns a streaming token-by-token response grounded in actual tool results (no fabricated numbers)
  2. The agent stops after at most 5-7 tool calls per query and returns a coherent answer rather than looping indefinitely
  3. When asked a question the agent cannot answer, it returns a plain-English error message rather than a raw stack trace or model error
  4. The agent refuses to give financial advice and states it is data-query only when prompted for advice
  5. All agent endpoint requests without a valid session cookie return 401 with no financial data
**Plans**: TBD

Plans:
- [ ] 02-01: ReAct executor + system prompt (agent.ts, prompt.ts, iteration cap, 30s timeout, Vercel AI SDK streamText integration)
- [ ] 02-02: Streaming chat API route (app/api/ai/chat/route.ts, Node.js runtime, iron-session auth, rate limiting, toUIMessageStreamResponse)

### Phase 3: Chat Widget UI
**Goal**: The chat widget is embedded in the dashboard and delivers a real conversational experience — streaming responses, visible reasoning steps, session memory, and graceful input handling
**Depends on**: Phase 2
**Requirements**: AGNT-03, AGNT-04, CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05
**Success Criteria** (what must be TRUE):
  1. The chat widget opens and closes from the dashboard without a page reload
  2. Typed messages stream back token-by-token with a visible typing indicator during tool execution
  3. Tool call activity is visible in the chat (e.g., "Checking your transactions...") so the user understands the agent is working
  4. Follow-up questions in the same browser session reference context from earlier messages correctly
  5. Submitting an empty message or a message exceeding the size limit shows a graceful error — the input does not crash or produce a broken request
**Plans**: TBD

Plans:
- [ ] 03-01: Chat hooks and state (hooks/use-chat.ts using @ai-sdk/react useChat, session memory, message history management)
- [ ] 03-02: Chat widget components (chat-widget.tsx, chat-message.tsx, tool-call-badge.tsx, typing-indicator.tsx, dashboard integration)

### Phase 4: PDF Report Generation
**Goal**: The user can generate an AI-narrated PDF financial report for any date range — both via a dashboard button and by asking the chat agent — and download it without any file being written to the server
**Depends on**: Phase 3
**Requirements**: PDF-01, PDF-02, PDF-03, PDF-04, PDF-05, PDF-06
**Success Criteria** (what must be TRUE):
  1. Clicking the report button on the dashboard, selecting a date range, and clicking generate triggers a PDF download in the browser
  2. The downloaded PDF contains a spending breakdown by category with correct totals that match the dashboard data
  3. The PDF contains an AI-written narrative paragraph summarizing trends for the selected period — not a template-filled string
  4. The PDF contains at least one anomaly highlight section when unusual charges exist in the selected date range
  5. Typing "Give me a report for January" in the chat produces the same PDF download as the dashboard button
  6. No PDF file is written to the server filesystem or the public/ directory at any point during generation
**Plans**: TBD

Plans:
- [ ] 04-01: PDF generation service (lib/ai/pdf.ts with PDFKit, spending breakdown layout, anomaly section, data freshness timestamp, disclaimer footer)
- [ ] 04-02: PDF API route + AI narrative (app/api/ai/report/route.ts, non-streaming agent run for narrative, binary buffer response, chat agent PDF trigger)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Foundation + Agent Tools | 0/2 | Not started | - |
| 2. ReAct Agent Core + Streaming Endpoint | 0/2 | Not started | - |
| 3. Chat Widget UI | 0/2 | Not started | - |
| 4. PDF Report Generation | 0/2 | Not started | - |
