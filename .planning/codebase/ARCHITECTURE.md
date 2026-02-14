# Architecture

**Analysis Date:** 2026-02-13

## Pattern Overview

**Overall:** Layered Client-Server Architecture with API-driven Frontend

**Key Characteristics:**
- Next.js 14 App Router based full-stack application
- Server-side authentication and authorization via middleware
- Separation of concerns: API routes, service layer, UI components
- Real-time data synchronization with third-party financial data provider (Plaid)
- PostgreSQL-backed persistent data with Drizzle ORM

## Layers

**Presentation (Client):**
- Purpose: Render UI and manage client-side state
- Location: `app/(auth)/`, `app/(dashboard)/`, `components/`
- Contains: Page components, UI components, charts, dashboard modules
- Depends on: API hooks, utility functions, types
- Used by: End users via browser

**API Route Layer:**
- Purpose: Expose RESTful endpoints for data operations
- Location: `app/api/`
- Contains: Next.js Route Handlers (GET, POST, PUT, DELETE)
- Depends on: Service layer, database, authentication middleware
- Used by: Client-side hooks and external webhooks (Plaid)

**Service/Business Logic Layer:**
- Purpose: Encapsulate domain logic, third-party integrations, data operations
- Location: `lib/` (plaid/, auth/, db/)
- Contains: Plaid client integration, authentication helpers, sync logic, projections
- Depends on: Database layer, cryptography utilities
- Used by: API routes

**Data Access Layer:**
- Purpose: Manage database connections and queries
- Location: `lib/db/`
- Contains: Drizzle ORM schema definitions and database client initialization
- Depends on: PostgreSQL driver
- Used by: Service layer

**Cross-Cutting Concerns:**
- Location: `middleware.ts`, `lib/auth/`, `lib/crypto.ts`
- Purpose: Handle authentication, encryption, rate limiting

## Data Flow

**Authentication Flow:**
1. User submits password via POST `/api/auth/login`
2. Route handler validates password against `DASHBOARD_PASSWORD_HASH`
3. Session created with `iron-session` (encrypted cookie)
4. Subsequent requests validated by `middleware.ts`
5. Session expires after 8 hours

**Financial Data Sync Flow:**
1. User initiates Plaid link via `PlaidLinkButton`
2. Frontend requests link token from `/api/plaid/link-token`
3. Plaid Link modal handles user connection
4. Frontend exchanges token via POST `/api/plaid/exchange-token`
5. Backend stores encrypted access token in `institutions` table
6. Background sync (via cron or manual trigger) calls `syncInstitution()`
7. Sync retrieves transactions via `lib/plaid/sync.ts`, stores in database
8. Webhook from Plaid triggers `/api/webhooks/plaid` for updates

**Dashboard Data Retrieval:**
1. Client-side page mounts and invokes hooks (e.g., `useDashboardSummary()`)
2. Hooks use SWR to fetch from API endpoints (e.g., `/api/dashboard/summary`)
3. API routes query database, compute aggregates
4. Results returned as JSON and cached by SWR
5. UI components render with data

**State Management:**
- Client: SWR (stale-while-revalidate) for API data caching
- Server: PostgreSQL for persistent state
- Session: iron-session encrypted cookies for authentication state
- No Redux/Context Store—data flows through API

## Key Abstractions

**Plaid Integration:**
- Purpose: Connect financial institutions, sync transactions and balances
- Examples: `lib/plaid/client.ts`, `lib/plaid/sync.ts`, `lib/plaid/link.ts`, `lib/plaid/webhooks.ts`
- Pattern: Plaid SDK initialized once, used across endpoints; webhook signature verification before processing

**Encryption (AES-256-GCM):**
- Purpose: Protect sensitive data like Plaid access tokens at rest
- Examples: `lib/crypto.ts`
- Pattern: Symmetric key from `ENCRYPTION_KEY` env var; IV + ciphertext + authTag stored together

**Rate Limiting:**
- Purpose: Prevent brute-force login attacks
- Examples: `lib/auth/rate-limit.ts`
- Pattern: In-memory rate limiter with 5 attempts per 15 minutes per IP

**Recurring Expenses:**
- Purpose: Project future spending based on historical patterns
- Examples: `lib/recurring.ts`, `lib/projections.ts`
- Pattern: Scan transaction history for patterns, calculate next occurrence dates, generate projections

**Dashboard Aggregation:**
- Purpose: Compute net worth, spending summaries, trends
- Examples: `app/api/dashboard/summary/route.ts`, `app/api/dashboard/spending-trends/route.ts`
- Pattern: Multi-table joins, aggregate functions, date-based filtering

## Entry Points

**Web Application:**
- Location: `app/layout.tsx` → `app/(auth)/login/page.tsx` or `app/(dashboard)/page.tsx`
- Triggers: Browser request to `/` or protected routes
- Responsibilities: Root layout, conditional routing (auth vs dashboard)

**API Endpoints (Examples):**
- `POST /api/auth/login`: Authenticate user
- `GET /api/dashboard/summary`: Fetch aggregated financial data
- `GET /api/accounts`: List all linked accounts grouped by institution
- `GET /api/transactions`: Paginated transaction list with filters
- `POST /api/plaid/link-token`: Create Plaid link session
- `POST /api/plaid/exchange-token`: Store Plaid token after user auth
- `POST /api/webhooks/plaid`: Receive transaction/account updates from Plaid

**Background/Trigger:**
- Plaid webhooks (event-driven)
- Manual sync triggers via UI
- Node-cron jobs (if configured; current code supports it)

## Error Handling

**Strategy:** Consistent try-catch with typed error responses

**Patterns:**
- API routes return `{ error: string }` with appropriate HTTP status codes
- Status codes: 400 (validation), 401 (auth), 429 (rate limit), 500 (server)
- Client errors logged to console in development
- Plaid SDK errors caught and mapped to institution status (active/error/relink_required)
- Webhook processing handles errors asynchronously to avoid blocking webhook acknowledgment

## Cross-Cutting Concerns

**Logging:**
- Server: console.log for debugging (visible in Next.js dev/build logs)
- Client: Browser console
- Note: Debug statement in login route (`console.log("DEBUG hash", ...)`) indicates in-progress development

**Validation:**
- Route handlers: Zod schemas for request bodies (e.g., `loginSchema`)
- Database: Drizzle ORM enforces schema constraints (non-null, unique, references)
- Client: SWR data validation implicit via TypeScript interfaces

**Authentication:**
- iron-session manages encrypted cookies with 8-hour TTL
- Middleware blocks unauthenticated access to API and page routes
- Password-based (single user dashboard); no multi-user support in schema
- Session checks at middleware level

**Encryption:**
- Plaid access tokens encrypted before storage via `lib/crypto.ts`
- Uses AES-256-GCM with random IV per token
- Decryption on-demand when syncing data

---

*Architecture analysis: 2026-02-13*
