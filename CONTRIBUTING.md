# Contributing to powerhour

Thank you for your interest in contributing. This guide covers the architecture, development setup, and conventions you need to know before submitting a pull request.

---

## Architecture overview

```
┌──────────────────────────────────────────────────────────┐
│  Browser (Next.js App Router — React client components)  │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTPS (nginx TLS termination)
┌────────────────────▼─────────────────────────────────────┐
│  Next.js 14 App Router — Node.js runtime                 │
│                                                          │
│  /app/(auth)       — login page                          │
│  /app/(dashboard)  — all protected pages                 │
│  /app/api/         — API routes (server-side only)       │
│                                                          │
│  Two AI agents:                                          │
│    Ticker           lib/agent/agent.ts        (chat)     │
│    Budget Planner   lib/agent/budget-planner-agent.ts    │
│                                                          │
│  In-process scheduler  lib/scheduler.ts                  │
│    – daily Plaid sync  (06:00)                           │
│    – weekly digest     (Monday 08:00)                    │
└────────────┬────────────────────────────┬────────────────┘
             │                            │
┌────────────▼────────┐    ┌─────────────▼──────────────┐
│  PostgreSQL (Drizzle│    │  Plaid API                 │
│  ORM, schema.ts)    │    │  (transactions, balances)  │
└─────────────────────┘    └────────────────────────────┘
```

### Key directories

| Path | Purpose |
|---|---|
| `app/(dashboard)/` | Protected pages (dashboard, transactions, subscriptions, …) |
| `app/api/` | API routes — all server-side, never bundled to client |
| `lib/agent/` | Agent executors + tool functions |
| `lib/agent/tools/` | Individual tool implementations (pure async functions) |
| `lib/db/` | Drizzle schema, migrations, DB client |
| `lib/auth/` | Session, rate limiting, password helpers |
| `lib/plaid/` | Plaid API wrappers (sync, link, webhooks) |
| `lib/demo/` | Demo mode seed data |
| `lib/digest/` | Weekly AI digest generator |
| `components/` | React components |
| `docker/` | Dockerfile, docker-compose, nginx config |
| `scripts/` | Standalone cron alternative (optional) |

---

## Local development

### Prerequisites

- Node.js 22+
- Docker + Docker Compose (for PostgreSQL)
- A Plaid account (or use demo mode — no Plaid required)
- A Google AI Studio API key for the AI agent

### Quick start

```bash
# 1. Clone and install
git clone https://github.com/your-username/powerhour.git
cd powerhour
npm install

# 2. Copy and fill in environment variables
cp .env.example .env
# Edit .env — see comments for each variable

# 3. For demo mode (no Plaid, no real data required):
#    Set DEMO_MODE=true and NEXT_PUBLIC_DEMO_MODE=true in .env

# 4. Start PostgreSQL
docker compose -f docker/docker-compose.yml up db -d

# 5. Run database migrations
npx drizzle-kit migrate

# 6. Start the dev server
npm run dev
```

The app runs at `http://localhost:3000`.

### Generating required secrets

```bash
# Encryption key (AES-256-GCM for Plaid access tokens)
openssl rand -hex 32

# Session secret (iron-session)
openssl rand -hex 64

# Password hash (bcrypt, cost factor 12)
node -e "const b=require('bcryptjs');b.hash('YOUR_PASSWORD',12).then(h=>console.log(h))"
```

---

## How to add a Ticker agent tool

The Ticker chat agent (`lib/agent/agent.ts`) exposes tools that let it query the database on behalf of the user. Adding a new tool is a four-step process:

### Step 1 — Write the tool function

Create `lib/agent/tools/your-tool-name.ts`:

```typescript
// lib/agent/tools/my-tool.ts
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";

export interface MyToolResult {
  // ...
}

export async function myTool(params: { someParam: string }): Promise<MyToolResult> {
  // Query the DB — use the agent_accounts_view for account data
  // (it excludes sensitive columns like plaid_access_token)
  const rows = await db.select(/* ... */);
  return { /* ... */ };
}
```

**Rules:**
- Tool functions are pure async functions — no side effects beyond DB reads
- Use `agent_accounts_view` / `agent_institutions_view` for account data (defined in `lib/db/views.ts`)
- Write functions; the `tool()` wrapper lives in `agent.ts`
- Return a plain serializable object

### Step 2 — Register the tool in agent.ts

```typescript
// lib/agent/agent.ts
import { myTool } from "./tools/my-tool";

const agentTools = {
  // ... existing tools
  myTool: tool({
    description: "One sentence: when should the agent call this? Include trigger phrases.",
    inputSchema: z.object({
      someParam: z.string().describe("What this param does"),
    }),
    execute: async (params) => myTool(params),
  }),
};
```

The description is the LLM's only signal for when to call your tool — write it like a docstring for a non-technical reader.

### Step 3 — Add a tool badge label

```typescript
// components/chat/tool-call-badge.tsx
const TOOL_LABELS: Record<string, string> = {
  // ...
  myTool: "Doing my thing",
};
```

### Step 4 — (Optional) Custom rendering

If your tool returns data that should render as something other than a loading badge, add a case to `components/chat/chat-message.tsx` similar to how `generateReport` renders a download button.

---

## Database migrations

This project uses Drizzle ORM with manual SQL migrations (not auto-generated).

### Adding a new table

1. Add the table definition to `lib/db/schema.ts`
2. Create `lib/db/migrations/000N_description.sql` with the SQL DDL
3. Add an entry to `lib/db/migrations/meta/_journal.json`
4. Run `npx drizzle-kit migrate` locally to apply

### Migration file format

```sql
CREATE TABLE "my_table" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_my_table_name" ON "my_table" ("name");
```

---

## Security conventions

- **Never use `NEXT_PUBLIC_` prefix for secrets.** Variables prefixed `NEXT_PUBLIC_` are baked into the client JS bundle.
- **Plaid access tokens are encrypted** with AES-256-GCM at rest (`lib/crypto.ts`). Do not store them plaintext.
- **Agent tools query DB views**, not base tables, to prevent accidental leakage of sensitive columns.
- **All mutations are logged** to the `audit_log` table via `lib/audit-log.ts`.
- **Rate limiting is layered**: nginx (login) + in-process `RateLimiterMemory` per endpoint.
- **Session expiry is 8 hours** (iron-session). There is no server-side session store; logout destroys the client cookie.

---

## Pull request guidelines

1. **Fork and branch** — create a feature branch from `main` (`feat/my-feature` or `fix/my-bug`)
2. **Keep PRs focused** — one feature or fix per PR makes review tractable
3. **Match existing patterns** — read a similar file before writing a new one
4. **No new dependencies without discussion** — open an issue first for significant new packages
5. **TypeScript strict** — the project uses `strict: true`; no `any` without a comment explaining why
6. **Test your changes** — manual testing at minimum; describe how you tested in the PR description

### Commit style

```
feat: add anomaly detection tool to Ticker agent
fix: prevent sync loop hanging on malformed Plaid cursor
chore: update drizzle-orm to 0.36
```

---

## Demo mode

Set `DEMO_MODE=true` and `NEXT_PUBLIC_DEMO_MODE=true` in `.env` to run the full app with realistic fake data — no Plaid account required. The seed runs automatically on startup via `instrumentation.ts`.

This is the recommended way to develop and test UI changes without live bank data.

---

## Questions?

Open an issue for bugs or feature requests. For larger architectural changes, open a discussion first.
