# Phase 1: Security Foundation + Agent Tools - Research

**Researched:** 2026-02-13
**Domain:** Security controls (pre-commit hooks, auth middleware, DB views) + Vercel AI SDK v6 agent tool functions
**Confidence:** HIGH (all critical claims verified via official docs and current npm packages)

---

## Summary

Phase 1 establishes two independent but related concerns: (1) security controls preventing secrets from leaking into the codebase or API responses, and (2) the five read-only Drizzle query functions that agent tools will call. Both must be complete and tested in isolation before any AI/LLM code is written.

The existing codebase already has solid security infrastructure: iron-session middleware in `middleware.ts` rejects unauthenticated API calls with 401, AES-256-GCM encryption for Plaid tokens in `lib/crypto.ts`, and `.env` in `.gitignore`. What is MISSING is: (a) pre-commit hooks to prevent accidental secret commits, (b) agent-facing database views that strip `plaid_access_token` and other encrypted blobs from query results, and (c) the five agent tool query functions themselves. No `GEMINI_API_KEY` exists in the environment yet.

The Vercel AI SDK is currently at **v6** (`ai@6.0.86`). The API has changed significantly from v4: tools use `inputSchema` (not `parameters`), multi-step loops use `stopWhen: stepCountIs(N)` (not `maxSteps`), and the streaming response is `result.toUIMessageStreamResponse()`. Drizzle's `pgView()` is fully supported for defining views in schema, but drizzle-kit **cannot create views via `db:push` or auto-migration** — views must be created via custom SQL migration (`drizzle-kit generate --custom`).

**Primary recommendation:** Build the five tool functions as pure async TypeScript functions that query Drizzle views (never base tables), test them in isolation, then wire them into AI SDK `tool()` wrappers in Phase 2.

---

## Standard Stack

### Core (already installed or to-add)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | `^0.45.1` (installed) | Type-safe DB queries for tool functions | Already in project; `pgView()` support for read-only agent views |
| `ai` | `^6.0.86` | Vercel AI SDK core — `tool()`, `streamText`, `stepCountIs` | Locked decision; v6 is current stable |
| `@ai-sdk/google` | latest | Google Gemini provider for `ai` SDK | Locked decision; provides `google('gemini-2.5-flash-lite')` |
| `@ai-sdk/react` | latest | `useChat` hook for client streaming | Locked decision; needed for Phase 2 UI |
| `zod` | `^3.25.76` (installed) | Input schema validation for tool definitions | Already in project; AI SDK v6 accepts Zod 3 schemas |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `husky` | `^9.x` | Git hook management for pre-commit scanning | Pre-commit secret scanning without manual hook maintenance |
| `lint-staged` | `^15.x` | Run checks only on staged files | Pair with husky for performance — only scan changed files |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `husky` + bash scan | Raw `.git/hooks/pre-commit` | Raw hooks aren't committed to repo; team members won't get them automatically |
| Drizzle `pgView()` for agent views | SELECT projection in tool function | Views enforce the exclusion at the DB layer; projections can drift if a developer modifies the SELECT |
| `stopWhen: stepCountIs(N)` | Custom loop logic | `stopWhen` is the v6 official API; hand-rolling loop control re-implements what AI SDK already handles |

**Installation (new packages only):**
```bash
npm install ai @ai-sdk/google @ai-sdk/react
npm install --save-dev husky lint-staged
npx husky init
```

---

## Architecture Patterns

### Recommended Project Structure

```
lib/
├── agent/
│   ├── tools/
│   │   ├── spending-summary.ts    # TOOL-01: getSpendingSummary()
│   │   ├── account-balances.ts    # TOOL-02: getAccountBalances()
│   │   ├── transaction-search.ts  # TOOL-03: searchTransactions()
│   │   ├── trend-comparison.ts    # TOOL-04: compareTrends()
│   │   └── recurring-expenses.ts  # TOOL-05: getRecurringExpenses()
│   └── index.ts                   # Exports tool() wrappers (Phase 2)
├── db/
│   ├── schema.ts                  # Existing tables
│   ├── views.ts                   # NEW: pgView definitions for agent
│   ├── migrations/
│   │   └── 0002_agent_views.sql   # Custom SQL: CREATE VIEW statements
│   └── index.ts                   # Existing db instance
app/
├── api/
│   └── agent/
│       └── chat/
│           └── route.ts           # Phase 2: POST handler with streamText
```

### Pattern 1: Agent-Facing Database Views (SEC-02, SEC-03)

**What:** PostgreSQL views that expose only safe columns — no `plaid_access_token`, no `sync_cursor`, no `error_code`. Defined in `lib/db/views.ts` using Drizzle `pgView()`, created via custom SQL migration.

**When to use:** Any Drizzle query inside an agent tool function MUST query these views, never the base `institutions` or `accounts` tables directly.

**View definitions (`lib/db/views.ts`):**
```typescript
// Source: https://orm.drizzle.team/docs/views
import { pgView } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { accounts, institutions, transactions, recurringItems } from "./schema";
import { text, uuid, numeric, boolean, timestamp, date } from "drizzle-orm/pg-core";

// Safe accounts view: strips no sensitive columns from accounts,
// but joins institutions WITHOUT plaid_access_token / sync_cursor / error_code
export const agentAccountsView = pgView("agent_accounts_view", {
  id: uuid("id"),
  name: text("name"),
  officialName: text("official_name"),
  type: text("type"),
  subtype: text("subtype"),
  currencyCode: text("currency_code"),
  currentBalance: numeric("current_balance", { precision: 14, scale: 2 }),
  availableBalance: numeric("available_balance", { precision: 14, scale: 2 }),
  creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }),
  isActive: boolean("is_active"),
  institutionName: text("institution_name"),
  institutionStatus: text("institution_status"),
}).existing();

// Safe institutions view: exposes name/status only, never access tokens
export const agentInstitutionsView = pgView("agent_institutions_view", {
  id: uuid("id"),
  institutionName: text("institution_name"),
  status: text("status"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
}).existing();
```

**Why `.existing()`:** drizzle-kit cannot generate CREATE VIEW DDL via `db:push` — views must be created via custom SQL migration and then referenced with `.existing()` in schema. The view creation SQL goes in `lib/db/migrations/XXXX_agent_views.sql`.

**Custom migration SQL:**
```sql
-- lib/db/migrations/XXXX_agent_views.sql
CREATE OR REPLACE VIEW agent_accounts_view AS
SELECT
  a.id,
  a.name,
  a.official_name,
  a.type,
  a.subtype,
  a.currency_code,
  a.current_balance,
  a.available_balance,
  a.credit_limit,
  a.is_active,
  i.institution_name,
  i.status AS institution_status
FROM accounts a
INNER JOIN institutions i ON a.institution_id = i.id
WHERE a.is_active = true;

CREATE OR REPLACE VIEW agent_institutions_view AS
SELECT
  id,
  institution_name,
  status,
  last_synced_at
FROM institutions;
```

Generate with: `npx drizzle-kit generate --custom --name=agent_views`
Apply with: `npm run db:migrate`

### Pattern 2: Agent Tool Function Shape (SEC-02, SEC-03, TOOL-01 through TOOL-05)

**What:** Each tool is a standalone async TypeScript function that accepts validated parameters, queries a Drizzle view (never a base table), and returns a typed result. No AI SDK dependency at this layer — these are plain async functions that AI SDK `tool()` will wrap in Phase 2.

**When to use:** All agent DB access. The function is the unit under test for Phase 1 success criteria.

**Template (`lib/agent/tools/spending-summary.ts`):**
```typescript
// TOOL-01: Spending summary by category/date range
// Queries agent_accounts_view (via transactions join) — never base tables
import { db } from "@/lib/db";
import { transactions, accounts } from "@/lib/db/schema";
import { and, gte, lte, gt, sql, eq } from "drizzle-orm";

export interface SpendingSummaryParams {
  from: string;   // ISO date "YYYY-MM-DD"
  to: string;     // ISO date "YYYY-MM-DD"
  category?: string;
}

export interface SpendingSummaryResult {
  summary: Array<{ category: string; amount: number; count: number }>;
  from: string;
  to: string;
  totalSpend: number;
}

export async function getSpendingSummary(
  params: SpendingSummaryParams
): Promise<SpendingSummaryResult> {
  const conditions = [
    gte(transactions.date, params.from),
    lte(transactions.date, params.to),
    gt(transactions.amount, "0"),
  ];
  if (params.category) {
    conditions.push(eq(transactions.category, params.category));
  }

  const result = await db
    .select({
      category: transactions.category,
      total: sql<string>`sum(${transactions.amount})`,
      count: sql<number>`count(*)::int`,
    })
    .from(transactions)
    // Join accounts (NOT institutions) — no sensitive institution data needed
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(...conditions))
    .groupBy(transactions.category);

  const summary = result.map((r) => ({
    category: r.category || "Uncategorized",
    amount: parseFloat(r.total || "0"),
    count: r.count,
  }));

  return {
    summary,
    from: params.from,
    to: params.to,
    totalSpend: summary.reduce((s, r) => s + r.amount, 0),
  };
}
```

### Pattern 3: API Route Auth for Agent Endpoint (SEC-01)

**What:** Agent POST route MUST check session via `getSession()` at the top of the handler — same pattern as all other protected routes. Middleware already covers all `/api/` paths, but belt-and-suspenders in-handler check is defensive best practice.

**Route handler (`app/api/agent/chat/route.ts`) — Phase 2, but auth pattern matters now:**
```typescript
// Source: https://nextjs.org/docs/app/getting-started/route-handlers
import { getSession } from "@/lib/auth/session";

export const maxDuration = 30; // SEC: 30s timeout cap

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }
  // ... agent logic
}
```

### Pattern 4: AI SDK v6 Tool Wrapper (Phase 2 preview — defines interface tool functions must satisfy)

**What:** The AI SDK `tool()` call wraps the pure async function. The `inputSchema` is the Zod schema that validates the LLM's tool call arguments. The `execute` calls the pure function.

```typescript
// Source: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
import { tool, streamText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { getSpendingSummary } from "@/lib/agent/tools/spending-summary";

const result = streamText({
  model: google("gemini-2.5-flash-lite"),
  stopWhen: stepCountIs(7), // SEC-05: iteration cap at 7
  tools: {
    getSpendingSummary: tool({
      description: "Get spending totals by category for a date range",
      inputSchema: z.object({
        from: z.string().describe("Start date in YYYY-MM-DD format"),
        to: z.string().describe("End date in YYYY-MM-DD format"),
        category: z.string().optional().describe("Filter to a specific category"),
      }),
      execute: async (params) => getSpendingSummary(params),
    }),
    // ... other tools
  },
  messages: modelMessages,
});

return result.toUIMessageStreamResponse();
```

### Anti-Patterns to Avoid

- **Querying base `institutions` table in agent tools:** The `plaid_access_token` column is AES-256-GCM encrypted text in the `institutions` table. Even though it's encrypted, the ciphertext blob should never appear in tool results. Use views or explicit column projections that exclude this column.
- **Using `NEXT_PUBLIC_` prefix on `GEMINI_API_KEY`:** Any env var prefixed with `NEXT_PUBLIC_` is bundled into client JavaScript. The key must be `GEMINI_API_KEY` (no prefix). SEC-04.
- **Using `maxSteps` in AI SDK v6:** This parameter no longer exists. Use `stopWhen: stepCountIs(N)` imported from `"ai"`.
- **Using `parameters` in tool definitions:** AI SDK v6 uses `inputSchema`, not `parameters`. The old v4 API signature breaks at runtime.
- **Relying on middleware alone for agent auth:** `middleware.ts` already covers all `/api/` routes, but the agent route should also call `getSession()` in-handler as a defense-in-depth check.
- **Creating DB views via `db:push`:** drizzle-kit cannot create views via push as of 2025. Use `drizzle-kit generate --custom --name=X` to create a blank SQL migration, add `CREATE VIEW` SQL manually, then `npm run db:migrate`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent loop with tool retry | Custom while-loop with tool dispatch | `streamText` + `stopWhen: stepCountIs(N)` | AI SDK handles tool call parsing, re-injection of results, step counting, error propagation, and streaming correctly — this is subtle and error-prone to replicate |
| Input validation for tool params | Custom type-checking in execute() | Zod `inputSchema` in `tool()` | AI SDK validates LLM output against the schema before calling execute; invalid LLM tool calls are rejected automatically |
| Streaming HTTP response | Custom SSE/chunked response | `result.toUIMessageStreamResponse()` | Returns the correct Content-Type, handles backpressure, formats tool call events in the protocol `useChat` expects |
| Secret scanning in CI | Custom regex grep scripts | Husky + bash scan on pre-commit | Bash scan on staged files catches `.env` copies, hard-coded keys, etc. before they hit git history |
| Session validation | Re-implementing iron-session logic | `getSession()` from `lib/auth/session.ts` | Already exists and correct; don't duplicate |

**Key insight:** The AI SDK's tool execution loop is the hardest part of agentic systems to get right — it involves parsing structured LLM output, maintaining conversation history, re-injecting tool results, and handling partial/failed tool calls. `streamText` + `tool()` handles all of this. The tool functions themselves (the `execute` body) are the correct place for custom logic.

---

## Common Pitfalls

### Pitfall 1: AI SDK `maxSteps` No Longer Exists (Breaking Change)

**What goes wrong:** Code using `streamText({ maxSteps: 5, ... })` throws a TypeScript error or silently ignores the param in v6, resulting in an uncapped loop or single-step completion.

**Why it happens:** v4/v5 used `maxSteps`; v6 replaces it with `stopWhen: stepCountIs(N)`.

**How to avoid:** Use `stopWhen: stepCountIs(7)` (per locked decision: 5-7 cap). Import `stepCountIs` from `"ai"`.

**Warning signs:** TypeScript error `Property 'maxSteps' does not exist on type...`; or agent completes in one step with no tool calls.

---

### Pitfall 2: Tool Definition Uses `parameters` Instead of `inputSchema`

**What goes wrong:** `tool({ parameters: z.object({...}), ... })` was v4 API. In v6 the key is `inputSchema`. The LLM never receives schema information; tool calls fail silently.

**Why it happens:** Most tutorials online, Stack Overflow answers, and LLM training data reference the v4 API.

**How to avoid:** Always use `inputSchema: z.object({...})`. Verify with TypeScript — the `tool()` helper is fully typed and will surface the error.

**Warning signs:** Model never calls tools; or calls them with empty/wrong parameters.

---

### Pitfall 3: DB View Creation Fails Silently via drizzle-kit push

**What goes wrong:** Developer adds `pgView().as(qb => ...)` to schema, runs `npm run db:push`, sees no error, but the view is not created in the database. Agent tool queries fail with "relation does not exist."

**Why it happens:** drizzle-kit does not support view creation via `push` or auto-generated migrations as of March 2025 (open issue #4265). The view definition in TypeScript is only used for type inference when querying.

**How to avoid:**
1. Define views with `.existing()` in `lib/db/views.ts` (for Drizzle type inference)
2. Create the actual view with a custom SQL migration:
   ```bash
   npx drizzle-kit generate --custom --name=agent_views
   # Edit the generated file to add CREATE VIEW SQL
   npm run db:migrate
   ```

**Warning signs:** `npm run db:push` succeeds but `SELECT * FROM agent_accounts_view` returns "relation does not exist".

---

### Pitfall 4: GEMINI_API_KEY Exposed in Client Bundle (SEC-04)

**What goes wrong:** If `GEMINI_API_KEY` is accidentally named `NEXT_PUBLIC_GEMINI_API_KEY`, Next.js bakes it into the client JavaScript bundle. Every user of the app can extract the key from their browser.

**Why it happens:** Developers sometimes add `NEXT_PUBLIC_` prefix when testing client-side fetch during development.

**How to avoid:** Name the variable `GEMINI_API_KEY` (no prefix). Only use it in route handlers and server-side code. Verify it's absent from client bundles with `npm run build && grep -r "AIza" .next/static` (Gemini keys start with "AIza").

**Warning signs:** Key visible in browser DevTools > Network > initiator JS files; or `NEXT_PUBLIC_GEMINI_API_KEY` appears in `.env.example`.

---

### Pitfall 5: Tool Results Include Encrypted Blobs (SEC-03)

**What goes wrong:** A tool function that JOINs `institutions` and selects `*` or forgets to exclude `plaid_access_token` returns the AES-256-GCM ciphertext in the tool result. This is stored in the AI SDK's message history and potentially logged.

**Why it happens:** Drizzle's `db.select().from(institutions)` returns all columns by default.

**How to avoid:** Agent tools MUST NOT join or select from the `institutions` table directly. Use `agent_accounts_view` (which joins institutions but only exposes `institution_name` and `institution_status`). If a tool needs more institution data, add a safe column to the view — never query the base table.

**Warning signs:** Tool result objects contain fields like `plaidAccessToken`, `syncCursor`, or long hex strings matching `iv:ciphertext:authTag` pattern.

---

### Pitfall 6: Pre-commit Hook Not Installed for All Developers

**What goes wrong:** A developer clones the repo, makes changes, commits — the pre-commit hook never runs because they didn't run `npm install` (which triggers the `prepare` script).

**Why it happens:** Husky hooks are installed via the `prepare` npm lifecycle script. Developers who clone without `npm install` skip this.

**How to avoid:** Add `"prepare": "husky"` to `package.json` scripts. Document in README that `npm install` must be run. For this single-developer project the risk is lower, but `npm install` already installs husky via `prepare`.

---

## Code Examples

Verified patterns from official sources:

### TOOL-02: Account Balances via View
```typescript
// Queries agent_accounts_view, never base institutions table
// SEC-03: plaid_access_token is excluded by view definition
import { db } from "@/lib/db";
import { agentAccountsView } from "@/lib/db/views";
import { eq } from "drizzle-orm";

export interface AccountBalancesResult {
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    currentBalance: number | null;
    availableBalance: number | null;
    institutionName: string;
  }>;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export async function getAccountBalances(): Promise<AccountBalancesResult> {
  const rows = await db
    .select()
    .from(agentAccountsView)
    .where(eq(agentAccountsView.isActive, true));

  let totalAssets = 0;
  let totalLiabilities = 0;

  const accounts = rows.map((r) => {
    const balance = parseFloat(String(r.currentBalance ?? "0"));
    if (r.type === "credit" || r.type === "loan") {
      totalLiabilities += Math.abs(balance);
    } else {
      totalAssets += balance;
    }
    return {
      id: r.id!,
      name: r.name!,
      type: r.type!,
      currentBalance: r.currentBalance ? parseFloat(String(r.currentBalance)) : null,
      availableBalance: r.availableBalance ? parseFloat(String(r.availableBalance)) : null,
      institutionName: r.institutionName!,
    };
  });

  return {
    accounts,
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
  };
}
```

### TOOL-03: Transaction Search (SEC-06: Input Validation)
```typescript
// Source: existing /app/api/transactions/route.ts pattern, adapted for agent
// SEC-06: Zod validates all inputs before DB query
import { db } from "@/lib/db";
import { transactions, accounts } from "@/lib/db/schema";
import { and, gte, lte, ilike, desc, sql, eq } from "drizzle-orm";
import { z } from "zod";

// Validation schema (also used as inputSchema in AI SDK tool() wrapper)
export const transactionSearchSchema = z.object({
  query: z.string().min(1).max(100).describe("Merchant name or keyword to search"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Start date YYYY-MM-DD"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("End date YYYY-MM-DD"),
  limit: z.number().int().min(1).max(50).default(20),
});

export type TransactionSearchParams = z.infer<typeof transactionSearchSchema>;

export async function searchTransactions(
  params: TransactionSearchParams
) {
  const conditions = [
    sql`(${ilike(transactions.name, `%${params.query}%`)} OR ${ilike(transactions.merchantName, `%${params.query}%`)})`,
  ];
  if (params.from) conditions.push(gte(transactions.date, params.from));
  if (params.to) conditions.push(lte(transactions.date, params.to));

  return db
    .select({
      id: transactions.id,
      date: transactions.date,
      name: transactions.name,
      merchantName: transactions.merchantName,
      amount: transactions.amount,
      category: transactions.category,
      accountName: accounts.name,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.date))
    .limit(params.limit);
}
```

### AI SDK v6 streamText with stopWhen (Phase 2 reference)
```typescript
// Source: https://ai-sdk.dev/docs/getting-started/nextjs-app-router
import { streamText, tool, stepCountIs, UIMessage, convertToModelMessages } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { getSpendingSummary } from "@/lib/agent/tools/spending-summary";

// export const maxDuration = 30; // Next.js route timeout cap
// Note: stopWhen: stepCountIs(7) maps to SEC-05 iteration cap

const result = streamText({
  model: google("gemini-2.5-flash-lite"),
  stopWhen: stepCountIs(7),
  messages: await convertToModelMessages(messages),
  tools: {
    getSpendingSummary: tool({
      description: "Get spending totals grouped by category for a date range",
      inputSchema: z.object({
        from: z.string().describe("Start date YYYY-MM-DD"),
        to: z.string().describe("End date YYYY-MM-DD"),
      }),
      execute: async (params) => getSpendingSummary(params),
    }),
  },
});

return result.toUIMessageStreamResponse();
```

### Pre-commit Hook for Secret Scanning
```bash
#!/bin/sh
# .husky/pre-commit
# Scan staged files for common secret patterns before commit

STAGED=$(git diff --cached --name-only --diff-filter=ACM)

for file in $STAGED; do
  # Reject any file that looks like a real .env
  if echo "$file" | grep -qE '^\.env$|^\.env\.(local|production|development)$'; then
    echo "ERROR: Attempting to commit $file — environment file blocked."
    exit 1
  fi

  # Scan for patterns that look like secrets in staged content
  CONTENT=$(git show ":$file" 2>/dev/null)

  # Plaid keys start with specific prefixes
  if echo "$CONTENT" | grep -qE 'access-sandbox-|access-development-|access-production-'; then
    echo "ERROR: Possible Plaid access token in $file. Commit blocked."
    exit 1
  fi

  # Google AI / Gemini API keys start with "AIza"
  if echo "$CONTENT" | grep -qE 'AIza[0-9A-Za-z_-]{35}'; then
    echo "ERROR: Possible Google API key in $file. Commit blocked."
    exit 1
  fi
done

exit 0
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `maxSteps: N` in streamText/generateText | `stopWhen: stepCountIs(N)` | AI SDK v5 → v6 (Dec 2025) | Breaking change — old param silently ignored or TypeScript error |
| `parameters: z.object({...})` in tool() | `inputSchema: z.object({...})` | AI SDK v5 | Breaking change — tool never receives schema info with old key |
| `StreamingTextResponse` | `result.toUIMessageStreamResponse()` | AI SDK v4 → v5 | Must use new method for `useChat` compatibility |
| Raw `.git/hooks/pre-commit` | Husky v9 + `prepare` script | Ongoing best practice | Hooks committed to repo and auto-installed on `npm install` |
| Querying base tables in agent tools | Querying PostgreSQL views | SEC pattern | Views enforce column exclusions at DB layer, not application layer |

**Deprecated/outdated:**
- `maxSteps`: Removed in AI SDK v6. Replaced by `stopWhen: stepCountIs(N)`.
- `parameters` key in `tool()`: Renamed to `inputSchema` in AI SDK v5+.
- `StreamingTextResponse` class: Use `result.toUIMessageStreamResponse()` instead.

---

## Open Questions

1. **Drizzle views and `db:push` command**
   - What we know: drizzle-kit cannot create views via `db:push` or auto-migration (confirmed by open issue #4265, March 2025). Views must be created via custom SQL migration.
   - What's unclear: Whether drizzle-kit v1.0 (beta, early 2025) added view support. The official docs say `.existing()` is for skipping migration generation, implying views CAN be defined with `.as()` for migration generation. Conflicting signals between docs and GitHub issues.
   - Recommendation: Use the safest approach — define views in `views.ts` with `.existing()` for type inference, create actual views via `CREATE VIEW` in a custom SQL migration file. This works regardless of whether drizzle-kit view support exists.

2. **Gemini 2.5 Flash Lite model ID stability**
   - What we know: Model ID is `gemini-2.5-flash-lite` per official `@ai-sdk/google` docs (confirmed). Went GA July 2025.
   - What's unclear: Whether newer preview variants (e.g., `gemini-2.5-flash-lite-preview-09-2025`) exist that should be used instead.
   - Recommendation: Use `gemini-2.5-flash-lite` as the model ID. If the Vercel AI SDK rejects it, try `gemini-2.5-flash-lite-preview-09-2025` as fallback. Confirm by running a test call.

3. **Agent route timeout on local dev vs production**
   - What we know: `export const maxDuration = 30` controls timeout for Vercel deployments. In local dev, there is no enforced timeout.
   - What's unclear: Whether the 30s timeout applies to the full streaming response or the time-to-first-token.
   - Recommendation: Set `maxDuration = 30` in the route file now. Test in local dev with a manual AbortController timeout wrapper if needed.

---

## Sources

### Primary (HIGH confidence)
- https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text — streamText API, `stopWhen`, `tools`, `inputSchema`
- https://ai-sdk.dev/docs/reference/ai-sdk-core/step-count-is — `stepCountIs()` import and usage
- https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling — `tool()` helper, full definition pattern
- https://ai-sdk.dev/docs/getting-started/nextjs-app-router — Route handler + streaming response pattern
- https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai — `gemini-2.5-flash-lite` model ID, `@ai-sdk/google` setup
- https://orm.drizzle.team/docs/views — `pgView()` syntax, `.existing()`, querying views
- https://orm.drizzle.team/docs/kit-custom-migrations — `drizzle-kit generate --custom --name=X`
- https://vercel.com/blog/ai-sdk-6 — AI SDK v6 release notes (Dec 22, 2025), `ToolLoopAgent`, breaking changes
- https://npmjs.com/package/ai — Confirmed version `6.0.86` as current

### Secondary (MEDIUM confidence)
- https://github.com/vercel/ai/discussions/8514 — Community discussion confirming `stopWhen` replaces `maxSteps`
- https://github.com/drizzle-team/drizzle-orm/issues/4265 — Open issue confirming views not created by `db:push` (March 2025)
- https://vercel.com/blog/ai-sdk-5 — Confirmed `inputSchema` (not `parameters`) introduced in v5

### Tertiary (LOW confidence)
- WebSearch results on Husky pre-commit patterns — general practice, not verified against official docs for this exact config

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm versions verified against npmjs.com; official docs confirm all APIs
- Architecture (DB views): HIGH — Drizzle docs confirm pgView syntax; custom migration limitation confirmed by open GH issue
- AI SDK tool API: HIGH — Official docs at ai-sdk.dev confirm all parameters
- Pitfalls: HIGH for documented breaking changes; MEDIUM for pre-commit hook patterns
- Pre-commit hooks: MEDIUM — Husky docs confirm setup; specific bash patterns are project-specific

**Research date:** 2026-02-13
**Valid until:** 2026-03-13 (30 days — AI SDK is fast-moving; verify stopWhen/stepCountIs signatures before implementing if >2 weeks pass)
