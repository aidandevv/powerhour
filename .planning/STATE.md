# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** The AI agent must answer financial questions accurately by querying real data — never hallucinate numbers, never expose credentials, never modify data.
**Current focus:** Phase 1 complete — ready for Phase 2 (AI Agent Loop)

## Current Position

Phase: 1 of 4 (Security Foundation + Agent Tools) — COMPLETE
Plan: 2 of 2 in current phase — COMPLETE
Status: Phase 1 complete, advance to Phase 2
Last activity: 2026-02-13 — Completed Plan 01-02 (all five agent tool functions)

Progress: [██░░░░░░░░] 20%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 5 min
- Total execution time: 0.17 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-security-foundation-agent-tools | 2/2 | 10 min | 5 min |

**Recent Trend:**
- Last 5 plans: 4 min, 6 min
- Trend: Consistent

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Gemini 2.5 Flash Lite via Vercel AI SDK v6 (ai + @ai-sdk/google + @ai-sdk/react) — no LangChain
- [Init]: ReAct loop via streamText + maxSteps — implemented from scratch
- [Init]: Agent tools must use agent-facing DB views (never base tables) to prevent token/encrypted field exposure
- [Init]: Iteration cap at 5-7 tool calls per query + 30s timeout — unbounded loop protection
- [01-01]: Pre-commit hook skips .husky/ directory to prevent false positives on error message strings containing pattern keywords
- [01-01]: NEXT_PUBLIC_GEMINI_API_KEY check uses =[^#] suffix — blocks assignments but allows comment/doc references
- [01-01]: agent_accounts_view filters WHERE is_active = true — AI agent sees only actively tracked accounts
- [01-01]: Custom SQL migration for views (drizzle-kit cannot auto-generate CREATE VIEW DDL); use .existing() for TypeScript type inference
- [01-02]: Tool functions are plain async functions, not AI SDK tool() wrappers — AI SDK coupling deferred to Phase 2 for clean separation of concerns
- [01-02]: transactionSearchSchema Zod schema exported from transaction-search.ts for Phase 2 AI SDK inputSchema reuse — avoids duplication
- [01-02]: getAccountBalances queries agentAccountsView (never base institutions join) — view enforces SEC-03 at DB layer
- [01-02]: Credit/loan balances treated as liabilities; depository/investment as assets — consistent net worth calculation

### Pending Todos

None.

### Blockers/Concerns

- [Phase 1]: Verify exact current rate limits for gemini-2.5-flash-lite on free tier before setting iteration cap thresholds (Google cut free-tier limits 50-92% in December 2025)
- [Phase 4]: Anomaly detection heuristic (transactions > 2 SD above category mean) not validated against actual transaction distribution — confirm during phase 4 planning

## Session Continuity

Last session: 2026-02-13
Stopped at: Completed Phase 1 Plan 02 (01-02-PLAN.md) — all five agent tool functions complete
Resume file: .planning/phases/02-ai-agent-loop/ (Phase 2 begins next)
