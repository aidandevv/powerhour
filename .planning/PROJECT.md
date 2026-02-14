# Financial Dashboard — AI Agent & Reports

## What This Is

A personal financial dashboard that aggregates bank accounts and transactions via Plaid, with a new AI agent layer powered by Gemini 2.5 Flash Lite. The agent lets you ask natural-language questions about your spending, balances, and trends through a chat widget — and can generate PDF reports with AI-written summaries. Built for personal use (~weekly), designed to be open-sourced and showcased on GitHub.

## Core Value

The AI agent must answer financial questions accurately by querying real data — never hallucinate numbers, never expose credentials, never modify data.

## Requirements

### Validated

- ✓ Single-user password authentication with encrypted sessions — existing
- ✓ Plaid integration for linking bank accounts — existing
- ✓ Transaction sync with cursor-based delta updates — existing
- ✓ Account balance tracking across institutions — existing
- ✓ Dashboard with spending summaries and trends — existing
- ✓ Recurring expense detection — existing
- ✓ AES-256-GCM encryption of sensitive tokens — existing
- ✓ Rate-limited login with brute-force protection — existing
- ✓ Docker-based deployment with Nginx reverse proxy — existing

### Active

- [ ] ReAct agent powered by Gemini 2.5 Flash Lite
- [ ] Chat widget in dashboard UI
- [ ] Streaming responses (token-by-token)
- [ ] Session-scoped conversation memory
- [ ] Read-only database query tools for the agent
- [ ] Spending recap queries ("How much did I spend on food this month?")
- [ ] Balance and net worth queries
- [ ] Transaction search ("Show me Amazon purchases last month")
- [ ] Trend analysis ("Am I spending more on dining out?")
- [ ] PDF report generation with date range selection
- [ ] AI-generated trend summaries in PDF reports
- [ ] AI-generated anomaly highlights in PDF reports
- [ ] Report generation via dashboard button
- [ ] Report generation via chat agent ("Give me a report for January")

### Out of Scope

- Multi-user support — single-user personal dashboard
- Write operations via the agent — read-only for safety
- Client-side API keys — Gemini key stays server-side only
- Real-time notifications or alerts — weekly use doesn't warrant it
- OAuth/social login — password auth is sufficient for single user
- Mobile app — web-only

## Context

This is a brownfield project with a working financial dashboard. The existing codebase uses Next.js 14 App Router, Drizzle ORM with PostgreSQL, SWR for client-side data fetching, and Tailwind CSS with Radix UI components. The agent feature should integrate naturally with existing patterns — API routes for the backend, SWR-style fetching on the frontend, Zod validation on inputs.

The ReAct (Reasoning + Acting) framework means the agent thinks step-by-step: it reasons about what data it needs, calls a tool to query the database, observes the result, then reasons again until it can answer. This is implemented from scratch — no LangChain or heavy frameworks. Gemini 2.5 Flash Lite is chosen for cost efficiency and speed on a lightweight personal tool.

Existing database tables (transactions, accounts, institutions, balance_snapshots, recurring_items) provide all the data the agent needs. The agent's tools are thin wrappers around existing Drizzle queries.

## Constraints

- **AI Model**: Gemini 2.5 Flash Lite — chosen for cost/speed, non-negotiable
- **Framework**: ReAct pattern implemented from scratch — no LangChain, no heavy agent frameworks
- **Security**: Agent is read-only, API key server-side only, all agent endpoints behind auth middleware
- **Weight**: Lightweight — minimal new dependencies, no new infrastructure
- **Showcase**: Code must be clean, well-structured, and suitable for open-source GitHub showcase

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Gemini 2.5 Flash Lite | Cost-efficient, fast for lightweight personal use | — Pending |
| ReAct from scratch | Keeps it lightweight, avoids heavy framework deps | — Pending |
| Read-only agent tools | Security-first: agent can never modify financial data | — Pending |
| Server-side API key | Never expose Gemini credentials to client | — Pending |
| Streaming responses | Better UX for chat interaction | — Pending |
| Session memory (client-side) | Conversation context without server-side storage overhead | — Pending |
| Chat widget + button for reports | Both quick-access button and conversational report generation | — Pending |

---
*Last updated: 2026-02-13 after initialization*
