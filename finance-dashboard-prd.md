# Personal Finance Dashboard — Product Requirements Document

**Version:** 1.0  
**Status:** Ready for Implementation  
**Stack:** Next.js · Node.js · PostgreSQL · Plaid API · Hetzner VPS  
**Audience:** Claude Code (implementation agent)

---

## 1. Project Overview

A self-hosted, open-source personal finance dashboard that aggregates spending, balances, and investment data across all financial institutions via the Plaid API. The application is single-user, security-first, and designed to run on a Hetzner VPS. Every user who runs this project supplies their own Plaid API credentials.

The core value proposition is a single pane of glass across all accounts — credit cards, checking, savings, investments, and liabilities — with projected expense tracking derived from recurring transaction patterns.

---

## 2. Goals & Non-Goals

### Goals
- Aggregate real-time and historical data from all linked financial institutions via Plaid
- Display unified balances, spending by category, net worth over time, and projected future expenses
- Encrypt all sensitive data at rest and in transit
- Be trivially self-hostable by any developer with a Hetzner (or equivalent) VPS
- Be open-source with clear documentation that each deployer must supply their own Plaid credentials

### Non-Goals
- Multi-user support (single user only)
- Mobile native app (responsive web only)
- Direct bank integrations outside of Plaid
- Financial advice, recommendations, or ML-based predictions beyond pattern-based recurring detection

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│              Next.js Frontend (App Router)       │
│     Dashboard · Transactions · Accounts ·        │
│         Net Worth · Projections · Settings       │
└──────────────────┬──────────────────────────────┘
                   │ Internal API Routes (tRPC or REST)
┌──────────────────▼──────────────────────────────┐
│              Next.js API Routes / Server         │
│                                                  │
│  ┌─────────────┐  ┌────────────┐  ┌──────────┐  │
│  │ Plaid Layer │  │ Aggregation│  │ Scheduler│  │
│  │ (sync,link, │  │& Transform │  │ (cron,   │  │
│  │  webhooks)  │  │  logic)    │  │ webhooks)│  │
│  └──────┬──────┘  └─────┬──────┘  └────┬─────┘  │
└─────────┼───────────────┼──────────────┼─────────┘
          │               │              │
┌─────────▼───────────────▼──────────────▼─────────┐
│                   PostgreSQL                      │
│  institutions · accounts · transactions ·         │
│      balance_snapshots · recurring_items          │
└───────────────────────┬──────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────┐
│                    Plaid API                      │
│   Transactions · Balance · Investments ·          │
│                 Liabilities                       │
└──────────────────────────────────────────────────┘
```

### Deployment Target
- Single Hetzner VPS (CAX11 or equivalent: 2 vCPU ARM, 4GB RAM)
- Docker Compose: Next.js app container + PostgreSQL container
- Nginx reverse proxy with Let's Encrypt TLS (Certbot)
- All traffic over HTTPS only; no HTTP fallback

---

## 4. Security Requirements

Security is the highest-priority non-functional requirement. The following must be implemented and must not be shortcuts.

### 4.1 Secrets Management
- All secrets (Plaid `client_id`, `secret`, `access_tokens`, database credentials, `SESSION_SECRET`, `ENCRYPTION_KEY`) are stored exclusively as environment variables, sourced from a `.env` file that is listed in `.gitignore` and never committed
- A `.env.example` file with placeholder values and documentation is committed in its place
- No secrets appear in logs, error messages, API responses, or client-side bundles

### 4.2 Plaid Access Token Encryption
- Plaid access tokens stored in the database must be encrypted at rest using **AES-256-GCM**
- Encryption key is a 32-byte random value stored as `ENCRYPTION_KEY` environment variable
- Implement a dedicated `crypto` utility module (`lib/crypto.ts`) with `encrypt(plaintext: string): string` and `decrypt(ciphertext: string): string` functions
- The encrypted value stored in the database must include the IV prepended (format: `iv:ciphertext`, both hex-encoded), so each encryption call produces a unique ciphertext even for identical inputs
- Access tokens must never appear in plaintext anywhere outside of the in-memory Plaid API call

### 4.3 Authentication
- The dashboard must be protected by a login page with a single-user password
- Password is stored as a **bcrypt hash** (cost factor 12 minimum) in the database or environment variable — never plaintext
- Sessions managed via **iron-session** or **next-auth** with a secure, httpOnly, sameSite=strict cookie
- Session secret is a minimum 64-character random string stored in `SESSION_SECRET` env var
- Failed login attempts are rate-limited: maximum 5 attempts per 15-minute window per IP (use `rate-limiter-flexible` backed by PostgreSQL or in-memory store)
- No "remember me" functionality — sessions expire after 8 hours of inactivity

### 4.4 Transport Security
- HTTPS enforced via nginx with TLS 1.2+ only; TLS 1.0 and 1.1 disabled
- HSTS header set with `max-age=31536000; includeSubDomains`
- nginx config must include: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy` (strict, no `unsafe-eval`, no `unsafe-inline` in script-src)
- Plaid webhook endpoint validates the `Plaid-Verification` header on every inbound webhook

### 4.5 Database Security
- PostgreSQL must not be exposed on any public port — accessible only on the internal Docker network
- Database connection uses SSL (`sslmode=require`) even on localhost/Docker network
- A dedicated non-superuser database role (`finance_app`) with only the minimum required privileges (SELECT, INSERT, UPDATE, DELETE on specific tables; no DROP, no CREATE)
- Automated daily `pg_dump` to an encrypted (gpg symmetric) backup file, stored locally and optionally uploaded to a private Hetzner Storage Box or S3-compatible object store

### 4.6 Input Validation & Injection Prevention
- All API route inputs validated with **Zod** before processing
- Parameterized queries only — no string concatenation for SQL; use **Drizzle ORM** or **node-postgres** with parameterized queries throughout
- Plaid webhook payload validated against Plaid's schema before any database writes

### 4.7 Dependency Security
- `npm audit` must pass with zero high or critical vulnerabilities at build time
- `package.json` must pin major versions; no `*` or `latest` version specifiers
- Dockerfile must use a specific, pinned base image tag (not `latest`)

---

## 5. Plaid Integration

### 5.1 Plaid Products Required
| Product | Purpose |
|---|---|
| `transactions` | Historical and ongoing spending data |
| `balance` | Real-time account balances |
| `investments` | Holdings, positions, portfolio value |
| `liabilities` | Credit card statement data, minimum payments |

### 5.2 Plaid Link Flow
- Implement the Plaid Link widget flow using `react-plaid-link`
- On Link success, exchange the `public_token` for an `access_token` server-side via `/api/plaid/exchange-token`
- Store the encrypted `access_token` and `item_id` in the `institutions` table
- Support re-linking for expired or revoked connections (detect `ITEM_LOGIN_REQUIRED` error and surface re-link UI)

### 5.3 Transaction Sync
- Use Plaid's cursor-based `/transactions/sync` endpoint (not the legacy date-range endpoint)
- Store the sync cursor per institution in the `institutions` table
- On each sync: process `added`, `modified`, and `removed` transaction arrays and upsert accordingly
- Pending transactions are stored with `is_pending = true` and updated when they clear
- Initial historical backfill on first link: sync until cursor exhausted (may require multiple calls)

### 5.4 Balance Snapshots
- Plaid only returns current balance, not historical — therefore take a daily balance snapshot for every account
- Snapshot stored in `balance_snapshots` table with `account_id`, `date`, `current`, `available`, `limit`
- This is what powers the net worth chart over time

### 5.5 Sync Schedule
- Daily cron job at 6:00 AM server local time syncs all institutions: transactions + balances
- Plaid webhooks (`TRANSACTIONS_SYNC_UPDATES_AVAILABLE`, `DEFAULT_UPDATE`) trigger immediate re-sync for real-time updates
- Webhook endpoint: `POST /api/webhooks/plaid` — must verify `Plaid-Verification` header

---

## 6. Database Schema

Use **Drizzle ORM** with PostgreSQL. Run migrations with `drizzle-kit`.

### 6.1 Tables

```sql
-- Linked financial institutions
CREATE TABLE institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plaid_item_id TEXT NOT NULL UNIQUE,
  plaid_access_token TEXT NOT NULL,       -- AES-256-GCM encrypted
  institution_name TEXT NOT NULL,
  institution_id TEXT NOT NULL,           -- Plaid institution_id
  sync_cursor TEXT,                       -- Plaid transaction sync cursor
  last_synced_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',  -- active | error | relink_required
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Accounts within each institution
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  plaid_account_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  official_name TEXT,
  type TEXT NOT NULL,        -- depository | credit | investment | loan
  subtype TEXT,              -- checking | savings | credit card | 401k | etc
  currency_code TEXT NOT NULL DEFAULT 'USD',
  current_balance NUMERIC(14, 2),
  available_balance NUMERIC(14, 2),
  credit_limit NUMERIC(14, 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transaction history
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  plaid_transaction_id TEXT NOT NULL UNIQUE,
  amount NUMERIC(14, 2) NOT NULL,         -- positive = debit, negative = credit
  currency_code TEXT NOT NULL DEFAULT 'USD',
  date DATE NOT NULL,
  name TEXT NOT NULL,                     -- merchant name or description
  merchant_name TEXT,                     -- cleaner merchant name if available
  category TEXT,                          -- Plaid primary category
  category_detailed TEXT,                 -- Plaid detailed category
  pending BOOLEAN NOT NULL DEFAULT false,
  payment_channel TEXT,                   -- online | in store | other
  logo_url TEXT,
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily balance snapshots for charting net worth over time
CREATE TABLE balance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  current_balance NUMERIC(14, 2),
  available_balance NUMERIC(14, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, snapshot_date)
);

-- Detected recurring transactions
CREATE TABLE recurring_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  merchant_name TEXT,
  amount NUMERIC(14, 2) NOT NULL,
  frequency TEXT NOT NULL,               -- weekly | biweekly | monthly | annually
  last_date DATE,
  next_projected_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_user_confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.2 Indexes
```sql
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_pending ON transactions(pending);
CREATE INDEX idx_balance_snapshots_date ON balance_snapshots(snapshot_date DESC);
CREATE INDEX idx_balance_snapshots_account ON balance_snapshots(account_id, snapshot_date DESC);
```

---

## 7. API Routes

All routes require authentication (session cookie). Return JSON. Use consistent error shape: `{ error: string, code?: string }`.

### 7.1 Plaid Link
| Method | Route | Description |
|---|---|---|
| POST | `/api/plaid/link-token` | Create Plaid Link token to initialize widget |
| POST | `/api/plaid/exchange-token` | Exchange public_token for access_token, store institution |
| GET | `/api/plaid/institutions` | List all linked institutions and their status |
| DELETE | `/api/plaid/institutions/:id` | Unlink institution, delete all data, revoke Plaid token |
| POST | `/api/plaid/institutions/:id/relink` | Re-link a connection that requires reauthentication |

### 7.2 Accounts & Balances
| Method | Route | Description |
|---|---|---|
| GET | `/api/accounts` | All accounts with current balances grouped by institution |
| GET | `/api/accounts/:id` | Single account detail |
| GET | `/api/accounts/:id/balance-history` | Balance snapshots for charting (query param: `?days=90`) |

### 7.3 Transactions
| Method | Route | Description |
|---|---|---|
| GET | `/api/transactions` | Paginated transaction list with filters: `?account_id`, `?category`, `?from`, `?to`, `?search`, `?page`, `?limit` |
| GET | `/api/transactions/summary` | Spending by category for a date range (`?from`, `?to`) |
| PATCH | `/api/transactions/:id` | Update category or note on a transaction |

### 7.4 Sync
| Method | Route | Description |
|---|---|---|
| POST | `/api/sync` | Trigger manual sync for all institutions |
| POST | `/api/sync/:institutionId` | Trigger manual sync for one institution |
| POST | `/api/webhooks/plaid` | Plaid webhook receiver (unauthenticated, but signature-verified) |

### 7.5 Dashboard & Projections
| Method | Route | Description |
|---|---|---|
| GET | `/api/dashboard/summary` | Net worth, total balances, month-to-date spending, and account summary |
| GET | `/api/dashboard/net-worth-history` | Daily net worth over time (`?days=365`) |
| GET | `/api/dashboard/spending-trends` | Monthly spending totals for last N months |
| GET | `/api/projections` | Projected expenses for next 30/60/90 days from recurring items |
| GET | `/api/recurring` | List all detected recurring items |
| PATCH | `/api/recurring/:id` | Confirm, edit, or deactivate a recurring item |

### 7.6 Auth
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | Login with password, set session cookie |
| POST | `/api/auth/logout` | Destroy session |
| GET | `/api/auth/me` | Return `{ authenticated: boolean }` — used for client-side guard |

---

## 8. Frontend Pages & Components

Built with Next.js App Router, TypeScript, and Tailwind CSS. Use **shadcn/ui** for component primitives. Charts via **Recharts**. Data fetching via **SWR** with revalidation.

### 8.1 Pages

| Route | Page | Description |
|---|---|---|
| `/login` | Login | Password entry, rate-limit feedback, redirect on success |
| `/` | Dashboard | Net worth, balance summary cards, recent transactions, spending ring chart, sync status |
| `/transactions` | Transactions | Paginated table with search, date range picker, category filter |
| `/accounts` | Accounts | All accounts grouped by institution with balance history sparklines |
| `/accounts/:id` | Account Detail | Full balance history chart + transaction list for one account |
| `/projections` | Projections | 30/60/90-day projected expense calendar, recurring items list |
| `/settings` | Settings | Link new institution (Plaid Link), manage linked institutions, trigger manual sync |

### 8.2 Key Components
- `NetWorthChart` — line chart of daily net worth using balance_snapshots (Recharts)
- `SpendingByCategoryChart` — donut/ring chart of MTD spending by category (Recharts)
- `SpendingTrendChart` — bar chart of monthly totals for last 6 months (Recharts)
- `AccountCard` — balance, account type, institution name, sync status indicator
- `TransactionTable` — sortable, filterable, paginated table with merchant logo
- `ProjectionCalendar` — 90-day forward view showing projected recurring charges per day
- `SyncStatusBanner` — shows last sync time and surfaces re-link prompts for errored institutions
- `PlaidLinkButton` — wraps `react-plaid-link`, handles token fetch and exchange flow

---

## 9. Recurring & Projection Logic

### 9.1 Recurring Detection
- Run after each transaction sync
- For each account, group transactions by normalized merchant name
- A transaction is flagged as potentially recurring if: same merchant appears 3+ times, amounts are within 5% of each other, and intervals are consistent (±3 days for monthly, ±1 day for weekly)
- Detected items are written to `recurring_items` with `is_user_confirmed = false`
- Surface unconfirmed items in the UI for user to confirm or dismiss

### 9.2 Projection Calculation
- For each active recurring item, calculate `next_projected_date` based on `last_date + frequency_days`
- Project forward 90 days, generating a list of `{ date, name, amount, account_id }` entries
- Aggregate by day for the calendar view, sum by week/month for the summary view
- Compare projected outflows against current `available_balance` to flag potential shortfalls

---

## 10. Project Structure

```
/
├── app/                        # Next.js App Router pages
│   ├── (auth)/login/
│   ├── (dashboard)/
│   │   ├── page.tsx            # Dashboard home
│   │   ├── transactions/
│   │   ├── accounts/
│   │   ├── projections/
│   │   └── settings/
│   └── api/                    # API routes
│       ├── auth/
│       ├── plaid/
│       ├── accounts/
│       ├── transactions/
│       ├── dashboard/
│       ├── projections/
│       ├── recurring/
│       ├── sync/
│       └── webhooks/plaid/
├── components/                 # Shared UI components
│   ├── charts/
│   ├── dashboard/
│   ├── transactions/
│   └── ui/                     # shadcn/ui primitives
├── lib/                        # Shared utilities
│   ├── crypto.ts               # AES-256-GCM encrypt/decrypt
│   ├── db/                     # Drizzle ORM config + schema
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   └── migrations/
│   ├── plaid/
│   │   ├── client.ts           # Plaid SDK initialization
│   │   ├── sync.ts             # Transaction sync logic
│   │   ├── link.ts             # Link token / exchange token
│   │   └── webhooks.ts         # Webhook verification + dispatch
│   ├── auth/
│   │   ├── session.ts          # iron-session config
│   │   └── rate-limit.ts       # Login rate limiter
│   ├── recurring.ts            # Recurring detection logic
│   └── projections.ts          # Projection calculation logic
├── hooks/                      # React hooks (useDashboard, useTransactions, etc.)
├── types/                      # Shared TypeScript types
├── scripts/
│   └── cron.ts                 # Daily sync cron (run via node-cron or standalone)
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   └── nginx/
│       └── nginx.conf
├── .env.example
├── .gitignore                  # Must include .env, *.pem, backups/
├── drizzle.config.ts
└── README.md
```

---

## 11. Environment Variables

Document all of these in `.env.example` with descriptions. None have default values that would be insecure.

```bash
# Plaid
PLAID_CLIENT_ID=                  # From Plaid dashboard
PLAID_SECRET=                     # From Plaid dashboard (development or production)
PLAID_ENV=development             # development | sandbox | production
PLAID_WEBHOOK_URL=                # Public URL for webhook delivery e.g. https://yourdomain.com/api/webhooks/plaid

# Database
DATABASE_URL=                     # postgresql://user:password@host:5432/dbname?sslmode=require

# Encryption (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=                   # 64 hex chars = 32 bytes for AES-256

# Session (generate with: openssl rand -hex 64)
SESSION_SECRET=                   # Min 64 chars

# Auth
DASHBOARD_PASSWORD_HASH=          # bcrypt hash of your chosen password

# App
NEXT_PUBLIC_APP_URL=              # e.g. https://finance.yourdomain.com
```

---

## 12. Docker & Deployment

### 12.1 Dockerfile
- Base image: `node:22-alpine` (pinned to specific digest)
- Multi-stage build: deps → builder → runner
- Run as non-root user (`node`)
- No dev dependencies in production image
- `.dockerignore` excludes `.env`, `node_modules`, `.git`

### 12.2 docker-compose.yml (production)
```yaml
services:
  app:
    build: .
    restart: unless-stopped
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
    networks: [internal]
    expose:
      - "3000"

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    env_file: .env
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks: [internal]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $POSTGRES_USER"]
      interval: 10s
      timeout: 5s
      retries: 5
    # No ports exposed to host — internal only

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on: [app]
    networks: [internal]

volumes:
  pgdata:

networks:
  internal:
    driver: bridge
```

### 12.3 nginx.conf Requirements
- Redirect all HTTP to HTTPS
- Proxy `proxy_pass http://app:3000`
- Set all security headers described in section 4.4
- Enable gzip compression for JS/CSS/JSON responses
- Rate limit `/api/auth/login` to 10 req/minute at the nginx layer as an additional defense

---

## 13. README Requirements

The README must include:

1. Prerequisites (Node 22+, Docker, Docker Compose, a Plaid developer account)
2. Plaid setup instructions — creating a developer account, getting API keys, configuring allowed redirect URIs
3. Step-by-step local development setup
4. Generating the required environment variable values (encryption key, session secret, password hash)
5. Production deployment walkthrough: provisioning Hetzner VPS, Docker installation, Certbot/Let's Encrypt TLS setup, DNS configuration
6. Backup procedure for the PostgreSQL database
7. A clear note that each deployer is responsible for their own Plaid API credentials and that this project is not affiliated with Plaid

---

## 14. Implementation Order

Build in this sequence to have a working foundation before adding features:

1. **Project scaffolding** — Next.js app, TypeScript, Tailwind, shadcn/ui, Drizzle ORM, Docker Compose with Postgres
2. **Auth** — Login page, session management, password hashing, rate limiting, middleware route guard
3. **Crypto utilities** — `lib/crypto.ts` with AES-256-GCM encrypt/decrypt
4. **Database schema + migrations** — All tables, indexes
5. **Plaid Link flow** — Link token creation, public token exchange, institution storage
6. **Transaction sync** — Cursor-based sync, upsert logic, balance snapshots
7. **Core API routes** — Accounts, transactions, dashboard summary
8. **Dashboard UI** — Net worth chart, balance cards, spending chart, recent transactions
9. **Transactions page** — Table with search and filters
10. **Accounts page** — Grouped by institution, sparklines
11. **Recurring detection + Projections** — Detection logic, projection API, projections page
12. **Webhooks** — Plaid webhook verification and sync trigger
13. **Settings page** — Plaid Link button, institution management, manual sync
14. **nginx config + TLS** — Security headers, HTTPS redirect, rate limiting
15. **README + .env.example** — Full deployment documentation
