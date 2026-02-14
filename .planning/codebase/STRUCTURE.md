# Codebase Structure

**Analysis Date:** 2026-02-13

## Directory Layout

```
financial-project/
├── app/                          # Next.js App Router (pages + API routes)
│   ├── api/                      # RESTful API endpoints
│   │   ├── auth/                 # Authentication endpoints
│   │   ├── accounts/             # Account data endpoints
│   │   ├── transactions/         # Transaction queries
│   │   ├── dashboard/            # Dashboard aggregates
│   │   ├── plaid/                # Plaid integration endpoints
│   │   ├── sync/                 # Manual sync triggers
│   │   ├── recurring/            # Recurring item management
│   │   └── webhooks/             # Third-party webhook handlers
│   ├── (auth)/                   # Auth group layout
│   │   └── login/                # Login page
│   ├── (dashboard)/              # Protected dashboard group layout
│   │   ├── accounts/             # Accounts list and detail pages
│   │   ├── transactions/         # Transactions page
│   │   ├── projections/          # Spending projections page
│   │   ├── settings/             # Settings page
│   │   ├── layout.tsx            # Dashboard wrapper with nav
│   │   └── page.tsx              # Dashboard home
│   ├── layout.tsx                # Root layout
├── components/                   # React UI components
│   ├── ui/                       # Base UI components (Radix-based)
│   │   ├── button.tsx, card.tsx, dialog.tsx, etc.
│   ├── dashboard/                # Dashboard-specific components
│   │   ├── nav.tsx               # Main navigation sidebar
│   │   ├── balance-cards.tsx      # Balance display cards
│   │   ├── account-card.tsx       # Account detail card
│   │   ├── recent-transactions.tsx
│   │   ├── sync-status-banner.tsx # Institution status display
│   │   └── plaid-link-button.tsx  # Plaid integration button
│   ├── charts/                   # Chart components
│   │   ├── net-worth-chart.tsx    # Historical net worth
│   │   ├── spending-trend-chart.tsx
│   │   └── spending-by-category-chart.tsx
│   └── transactions/             # Transaction-specific components
│       └── transaction-table.tsx
├── lib/                          # Shared utility and service code
│   ├── db/                       # Database layer
│   │   ├── index.ts              # Drizzle client initialization
│   │   └── schema.ts             # ORM schema definitions
│   ├── plaid/                    # Plaid integration services
│   │   ├── client.ts             # Plaid SDK instance
│   │   ├── sync.ts               # Transaction/balance sync logic
│   │   ├── link.ts               # Link token creation
│   │   ├── webhooks.ts           # Webhook verification and handlers
│   ├── auth/                     # Authentication utilities
│   │   ├── session.ts            # iron-session helpers
│   │   └── rate-limit.ts         # Login rate limiter
│   ├── crypto.ts                 # AES-256-GCM encryption/decryption
│   ├── projections.ts            # Spending projection calculations
│   ├── recurring.ts              # Recurring expense detection
│   └── utils.ts                  # General utilities (formatting, etc.)
├── hooks/                        # React custom hooks
│   ├── use-accounts.ts           # Fetch accounts via SWR
│   ├── use-dashboard.ts          # Fetch dashboard aggregates
│   └── use-transactions.ts       # Fetch transactions with filters
├── types/                        # TypeScript type definitions
│   └── index.ts                  # Shared types and interfaces
├── docker/                       # Docker configuration
│   └── nginx/                    # Nginx reverse proxy config
├── scripts/                      # Build/utility scripts
├── public/                       # Static assets
├── middleware.ts                 # Next.js request middleware (auth)
├── drizzle.config.ts             # Drizzle ORM configuration
├── next.config.js                # Next.js build configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
├── postcss.config.js             # PostCSS plugins
├── package.json                  # Dependencies and scripts
├── .env                          # Environment variables (secrets)
├── .env.example                  # Environment template
└── .gitignore                    # Git ignore rules
```

## Directory Purposes

**app/**
- Purpose: Next.js App Router entry point for pages and API routes
- Contains: All routable pages, layouts, and API endpoints
- Key files: `layout.tsx` (root), `(auth)/login/page.tsx`, `(dashboard)/page.tsx`

**app/api/**
- Purpose: RESTful API endpoints consumed by frontend
- Contains: Route handlers for CRUD and integration operations
- Key files: Auth, accounts, transactions, dashboard aggregates, Plaid endpoints, webhooks

**app/(dashboard)/**
- Purpose: Protected dashboard pages and layouts
- Contains: Account pages, transaction lists, projections, settings
- Key files: `layout.tsx` (with navigation), individual page components

**components/**
- Purpose: Reusable React components organized by domain
- Contains: UI primitives (buttons, cards, dialogs), dashboard layouts, charts, tables
- Key files: `ui/*` (base components), `dashboard/*` (composed sections), `charts/*`

**lib/db/**
- Purpose: Database abstraction layer
- Contains: Drizzle ORM schema and client
- Key files: `schema.ts` (all table definitions), `index.ts` (client initialization)

**lib/plaid/**
- Purpose: Plaid financial data integration
- Contains: SDK client, sync logic, link token creation, webhook handlers
- Key files: `client.ts`, `sync.ts`, `link.ts`, `webhooks.ts`

**lib/auth/**
- Purpose: Authentication and authorization utilities
- Contains: Session management, rate limiting
- Key files: `session.ts`, `rate-limit.ts`

**hooks/**
- Purpose: Client-side React hooks for data fetching with SWR
- Contains: Hooks for accounts, dashboard, transactions
- Key files: `use-accounts.ts`, `use-dashboard.ts`, `use-transactions.ts`

**types/**
- Purpose: Shared TypeScript interfaces and types
- Contains: API response types, domain models
- Key files: `index.ts` (all types)

## Key File Locations

**Entry Points:**
- `app/layout.tsx`: Root layout wrapping all pages
- `app/(dashboard)/layout.tsx`: Dashboard layout with navigation
- `app/(auth)/login/page.tsx`: Login page (public)
- `app/(dashboard)/page.tsx`: Dashboard home (protected)

**Configuration:**
- `middleware.ts`: Global authentication/authorization checks
- `drizzle.config.ts`: Database migration and schema configuration
- `next.config.js`: Next.js build options (standalone output)
- `tsconfig.json`: TypeScript compiler options (path alias: `@/*`)
- `tailwind.config.ts`: Tailwind CSS customization
- `.env`: Environment variables (API keys, secrets)

**Core Logic:**
- `lib/db/schema.ts`: Complete database schema (institutions, accounts, transactions, balances, recurring)
- `lib/plaid/sync.ts`: Financial data synchronization logic
- `lib/plaid/webhooks.ts`: Plaid event handling
- `lib/auth/session.ts`: Session management (8-hour TTL)
- `lib/crypto.ts`: AES-256-GCM encryption for sensitive data

**Data Fetching:**
- `hooks/use-accounts.ts`: Account listing with institution grouping
- `hooks/use-dashboard.ts`: Dashboard summary, net worth history, spending trends
- `app/api/accounts/route.ts`: Account data with institution join
- `app/api/dashboard/summary/route.ts`: Net worth, assets, liabilities, spending
- `app/api/transactions/route.ts`: Paginated transactions with filtering

**Authentication:**
- `app/api/auth/login/route.ts`: Password validation and session creation
- `app/api/auth/logout/route.ts`: Session destruction
- `lib/auth/rate-limit.ts`: 5 attempts per 15 minutes per IP

## Naming Conventions

**Files:**
- Pages: `page.tsx` (required by Next.js)
- API routes: `route.ts` (required by Next.js)
- Layouts: `layout.tsx` (required by Next.js)
- Middleware: `middleware.ts` (required by Next.js)
- Components: PascalCase (e.g., `BalanceCards.tsx`, `NetWorthChart.tsx`)
- Hooks: `use-<name>.ts` (e.g., `use-accounts.ts`)
- Utilities/Services: camelCase (e.g., `sync.ts`, `projections.ts`)
- Types: Single `index.ts` per domain or shared `types/index.ts`

**Directories:**
- Feature groupings: lowercase (e.g., `app/api/accounts/`, `lib/plaid/`)
- Route groups: Parentheses (e.g., `(auth)`, `(dashboard)`)
- Domain modules: lowercase plural (e.g., `accounts`, `transactions`)

## Where to Add New Code

**New Feature (e.g., Budget Tracking):**
- API endpoints: `app/api/budgets/route.ts`, `app/api/budgets/[id]/route.ts`
- Page: `app/(dashboard)/budgets/page.tsx`
- Component: `components/dashboard/budget-card.tsx`
- Service logic: `lib/budgets.ts`
- Hook: `hooks/use-budgets.ts`
- Types: Add to `types/index.ts`

**New API Endpoint:**
- Location: `app/api/<resource>/route.ts`
- Pattern: Try-catch with `NextResponse.json()`, typed errors
- Example: `app/api/transactions/[id]/route.ts` for single transaction detail

**New UI Component:**
- Location: `components/<category>/<component-name>.tsx`
- Use Radix UI + Tailwind for styling
- Base components in `components/ui/`, composed components in `components/dashboard/` or `components/charts/`

**New Service/Utility:**
- Location: `lib/<domain>/<function>.ts` or `lib/<function>.ts`
- Export as named exports
- Example: `lib/categories.ts` for category utilities

**New Client Hook:**
- Location: `hooks/use-<resource>.ts`
- Pattern: SWR wrapper with typed response
- Use `const fetcher = (url) => fetch(url).then(res => res.json())`

## Special Directories

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (via npm install)
- Committed: No (see .gitignore)

**.next/:**
- Purpose: Next.js build output and cache
- Generated: Yes (via npm run build)
- Committed: No

**docker/:**
- Purpose: Docker/deployment configuration
- Generated: No (manually maintained)
- Committed: Yes
- Contains: Nginx configuration for reverse proxy

**scripts/:**
- Purpose: Build or setup scripts
- Generated: No (manually maintained)
- Committed: Yes
- Examples: Database seed scripts, migration helpers

**public/:**
- Purpose: Static assets served at root (favicon, images, etc.)
- Generated: No (manually maintained)
- Committed: Yes

---

*Structure analysis: 2026-02-13*
