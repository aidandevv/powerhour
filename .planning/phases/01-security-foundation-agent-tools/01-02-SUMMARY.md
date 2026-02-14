---
phase: 01-security-foundation-agent-tools
plan: "02"
subsystem: database
tags: [drizzle-orm, postgresql, agent-tools, zod, typescript, security]

# Dependency graph
requires:
  - phase: 01-01
    provides: "agentAccountsView and agentInstitutionsView PostgreSQL views with sensitive columns excluded; pre-commit hook protecting secrets"
provides:
  - Five pure async TypeScript agent tool functions in lib/agent/tools/ — no AI SDK imports
  - TOOL-01 getSpendingSummary: spending by category for date range
  - TOOL-02 getAccountBalances: all account balances with net worth, using agentAccountsView
  - TOOL-03 searchTransactions: keyword/merchant search with Zod input validation schema
  - TOOL-04 compareTrends: two-period spending comparison with delta/percent/trend
  - TOOL-05 getRecurringExpenses: active recurring items with monthly normalization
  - transactionSearchSchema (Zod) exported from transaction-search.ts for Phase 2 AI SDK inputSchema reuse
affects:
  - 02 (Phase 2 — AI agent loop wraps these functions with AI SDK tool() and inputSchema)
  - all future agent features depend on these functions returning correct typed data

# Tech tracking
tech-stack:
  added: []
  patterns:
    - All agent tool functions are pure async TypeScript functions — no AI SDK or framework coupling
    - transactionSearchSchema exported for dual-use: runtime validation in TOOL-03 and AI SDK inputSchema in Phase 2
    - Zod parse() called at function entry for SEC-06 input sanitization before any DB query
    - TOOL-02 queries agentAccountsView (never base accounts+institutions join) — view enforces SEC-03 at DB layer
    - All other tools join only accounts table for account name — no institutions table access anywhere

key-files:
  created:
    - lib/agent/tools/spending-summary.ts
    - lib/agent/tools/account-balances.ts
    - lib/agent/tools/transaction-search.ts
    - lib/agent/tools/trend-comparison.ts
    - lib/agent/tools/recurring-expenses.ts
  modified: []

key-decisions:
  - "Tool functions are plain async functions, not AI SDK tool() wrappers — AI SDK coupling deferred to Phase 2 for clean separation of concerns"
  - "transactionSearchSchema Zod object exported from transaction-search.ts for reuse as AI SDK inputSchema in Phase 2"
  - "TOOL-02 uses agentAccountsView (never base institutions join) — view enforces SEC-03 exclusion of plaid_access_token at DB layer"
  - "Credit/loan balances classified as liabilities; depository/investment as assets — consistent net worth calculation"

patterns-established:
  - "SEC-02 pattern: All five tools use Drizzle .select() — SELECT-only queries, no INSERT/UPDATE/DELETE possible"
  - "SEC-03 pattern: No tool file imports from institutions table — sensitive columns excluded at view or query design level"
  - "SEC-06 pattern: Zod schema validation at function entry before DB query (transaction-search.ts model)"
  - "Tool isolation pattern: Each tool function in its own file — single responsibility, independently testable"

# Metrics
duration: 6min
completed: 2026-02-13
---

# Phase 1 Plan 02: Agent Tool Functions Summary

**Five pure async Drizzle TypeScript tool functions for the AI agent — spending summary, account balances (via safe view), transaction search (Zod-validated), trend comparison, and recurring expenses — all SEC-02/03 compliant with no institutions table access**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-14T02:10:23Z
- **Completed:** 2026-02-14T02:16:26Z
- **Tasks:** 2
- **Files modified:** 5 (all created)

## Accomplishments

- Created five agent tool functions as pure TypeScript async functions with full typed interfaces — no AI SDK coupling, no `any` types, ready to be wrapped by Phase 2's AI SDK `tool()` calls
- TOOL-02 (`getAccountBalances`) queries `agentAccountsView` from Phase 1 Plan 01 — sensitive columns excluded at the database view layer, never base institutions table
- TOOL-03 (`searchTransactions`) exports `transactionSearchSchema` Zod object for dual use: runtime SEC-06 input validation today and Phase 2 AI SDK `inputSchema` reuse

## Task Commits

Each task was committed atomically:

1. **Task 1: TOOL-01 getSpendingSummary + TOOL-02 getAccountBalances** - `f26232b` (feat)
2. **Task 2: TOOL-03 searchTransactions + TOOL-04 compareTrends + TOOL-05 getRecurringExpenses** - `4efdd7f` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `lib/agent/tools/spending-summary.ts` - TOOL-01: groups transactions by category for date range, excludes pending, joins accounts (not institutions)
- `lib/agent/tools/account-balances.ts` - TOOL-02: queries agentAccountsView (SEC-03 safe), classifies assets/liabilities, computes net worth
- `lib/agent/tools/transaction-search.ts` - TOOL-03: Zod-validated ilike search on name/merchantName, exports transactionSearchSchema for Phase 2
- `lib/agent/tools/trend-comparison.ts` - TOOL-04: parallel period queries via Promise.all, computes delta/deltaPercent/trend enum
- `lib/agent/tools/recurring-expenses.ts` - TOOL-05: joins recurringItems+accounts, normalizes weekly/biweekly/monthly/annually to monthly estimate

## Decisions Made

- Tool functions are plain async functions, not AI SDK `tool()` wrappers — decoupling data access from the AI framework enables independent testing and keeps Phase 2 focused on the agent loop
- `transactionSearchSchema` Zod schema exported from `transaction-search.ts` for reuse as AI SDK `inputSchema` in Phase 2 — avoids schema duplication
- `getAccountBalances` queries `agentAccountsView` (never base institutions join) — view enforces SEC-03 exclusion of `plaid_access_token` at the DB layer rather than relying on SELECT projection
- Credit and loan account balances treated as liabilities, depository/investment as assets — consistent net worth calculation pattern

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- `npx ts-node` inline `-e` flag failed with parse errors on special characters in the eval string — resolved by using temp `.ts` files with `npx tsx --env-file=.env` for smoke tests, which also correctly loaded `DATABASE_URL` from `.env`
- Smoke test output for TOOL-04 showed `trend: unchanged, delta: 0` because no transactions exist in Jan–Feb 2025 in seeded test data — this is correct behavior (empty periods produce zero delta), not a bug

## User Setup Required

None — no external service configuration required. All tool functions query the existing PostgreSQL database via `DATABASE_URL`.

## Next Phase Readiness

- All five tool functions callable, typed, and verified against real database
- `transactionSearchSchema` ready to be passed directly as `inputSchema` to AI SDK `tool()` in Phase 2
- Functions return no sensitive fields (`plaidAccessToken`, `syncCursor`, `errorCode`) — confirmed by smoke tests
- Phase 2 (AI agent loop) can import any tool from `@/lib/agent/tools/[tool-name]` and wrap with `tool({ description, inputSchema, execute })`

## Self-Check: PASSED

- FOUND: lib/agent/tools/spending-summary.ts (exports getSpendingSummary, SpendingSummaryParams, SpendingSummaryResult)
- FOUND: lib/agent/tools/account-balances.ts (exports getAccountBalances, AccountBalancesResult)
- FOUND: lib/agent/tools/transaction-search.ts (exports searchTransactions, transactionSearchSchema, TransactionSearchParams)
- FOUND: lib/agent/tools/trend-comparison.ts (exports compareTrends, TrendComparisonParams, TrendComparisonResult)
- FOUND: lib/agent/tools/recurring-expenses.ts (exports getRecurringExpenses, RecurringExpensesResult)
- COMMIT f26232b: feat(01-02): implement TOOL-01 getSpendingSummary and TOOL-02 getAccountBalances
- COMMIT 4efdd7f: feat(01-02): implement TOOL-03 searchTransactions, TOOL-04 compareTrends, TOOL-05 getRecurringExpenses
- DB VERIFIED: TOOL-01 returned 9 spending categories from real data with correct totalSpend
- DB VERIFIED: TOOL-02 returned 12 accounts with totalAssets=86541.74, totalLiabilities=126994.06, netWorth=-40452.32
- DB VERIFIED: TOOL-03 returned 3 matching transactions with all 7 expected fields
- DB VERIFIED: No plaidAccessToken, syncCursor, or errorCode fields in any tool result
- TypeScript: npx tsc --noEmit — zero errors on all agent tool files

---
*Phase: 01-security-foundation-agent-tools*
*Completed: 2026-02-13*
