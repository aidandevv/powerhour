# Technology Stack

**Analysis Date:** 2026-02-13

## Languages

**Primary:**
- TypeScript 5.9.3 - All application source code
- JavaScript - Build and configuration files

**Secondary:**
- Bash - Docker and deployment scripts

## Runtime

**Environment:**
- Node.js 22 (Alpine) - Required version from Dockerfile
- Next.js 14.2.35 - Full-stack React framework

**Package Manager:**
- npm - Node package manager
- Lockfile: package-lock.json (present)

## Frameworks

**Core:**
- Next.js 14.2.35 - Full-stack React application with App Router
- React 18.3.1 - UI component framework
- React DOM 18.3.1 - DOM rendering

**UI/Styling:**
- Tailwind CSS 3.4.19 - Utility-first CSS framework
- PostCSS 8.5.6 - CSS transformation
- Autoprefixer 10.4.24 - CSS vendor prefixing
- Radix UI Components:
  - @radix-ui/react-dialog (1.1.15)
  - @radix-ui/react-dropdown-menu (2.1.16)
  - @radix-ui/react-label (2.1.8)
  - @radix-ui/react-select (2.2.6)
  - @radix-ui/react-separator (1.1.8)
  - @radix-ui/react-slot (1.2.4)
  - @radix-ui/react-tabs (1.1.13)
- class-variance-authority 0.7.1 - CSS class composition
- clsx 2.1.1 - Conditional CSS class combining
- tailwind-merge 2.6.1 - Merge Tailwind CSS classes

**Data Visualization:**
- Recharts 2.15.4 - React charting library for financial dashboards

**Icons:**
- lucide-react 0.563.0 - Icon library

**Database:**
- Drizzle ORM 0.45.1 - Type-safe ORM
- drizzle-kit 0.31.9 - Drizzle CLI and migrations
- postgres 3.4.8 - PostgreSQL client library
- PostgreSQL 16-Alpine - Database server (Docker)

**Authentication & Security:**
- iron-session 8.0.4 - Encrypted session management
- bcryptjs 2.4.3 - Password hashing
- Native Node.js crypto module - AES-256-GCM encryption for sensitive tokens

**API Integration:**
- plaid 28.0.0 - Official Plaid API SDK
- react-plaid-link 3.6.1 - React component for Plaid Link (embedded iframe)

**Data Fetching:**
- SWR 2.4.0 - React data fetching and caching library

**Rate Limiting:**
- rate-limiter-flexible 5.0.5 - In-memory rate limiting

**Scheduling:**
- node-cron 3.0.3 - Task scheduling and cron jobs

**Validation:**
- Zod 3.25.76 - TypeScript-first schema validation

**Development:**
- ESLint 8.57.1 - Linting
- eslint-config-next 14.2.35 - Next.js ESLint configuration
- TypeScript 5.9.3 - Type checking
- @types/node 22.19.11 - Node.js type definitions
- @types/react 18.3.28 - React type definitions
- @types/react-dom 18.3.7 - React DOM type definitions
- @types/bcryptjs 2.4.6 - bcryptjs type definitions
- @types/node-cron 3.0.11 - node-cron type definitions

## Configuration

**Environment:**
- `.env` file (required, not committed) - See `.env.example` for structure
- Key variables:
  - `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` - Plaid API credentials
  - `DATABASE_URL` - PostgreSQL connection string
  - `ENCRYPTION_KEY` - 64-character hex key for AES-256-GCM
  - `SESSION_SECRET` - Minimum 64 characters for iron-session
  - `DASHBOARD_PASSWORD_HASH` - bcrypt hash (cost factor >= 12)
  - `NEXT_PUBLIC_APP_URL` - Public application URL
  - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` - Database credentials

**Build:**
- `tsconfig.json` - TypeScript compiler configuration with path aliases (`@/*`)
- `next.config.js` - Next.js configuration (standalone output mode)
- `tailwind.config.ts` - Tailwind CSS theme and plugin configuration
- `drizzle.config.ts` - Drizzle ORM configuration (PostgreSQL dialect, migrations in `lib/db/migrations`)
- `.eslintrc.json` - Implicit ESLint config (next lint)
- `postcss.config.js` - PostCSS configuration for Tailwind

## Platform Requirements

**Development:**
- Node.js 22 or compatible
- PostgreSQL 16 (or compatible) with environment variables
- npm (or compatible package manager)

**Production:**
- Docker environment with docker-compose support
- PostgreSQL 16-Alpine database service
- Nginx 1.27-Alpine reverse proxy
- Let's Encrypt SSL certificates (at `/etc/letsencrypt`)
- Outbound network access for Plaid API (https://development|sandbox|production.plaid.com)

**Database:**
- PostgreSQL 16 (specified in docker-compose.yml)
- Schema defined via Drizzle ORM in `lib/db/schema.ts`
- Migrations managed by drizzle-kit

---

*Stack analysis: 2026-02-13*
