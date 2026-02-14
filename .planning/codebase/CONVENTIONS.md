# Coding Conventions

**Analysis Date:** 2026-02-13

## Naming Patterns

**Files:**
- API routes: `route.ts` - Next.js App Router convention, located in `app/api/` structure
- React components: PascalCase with `.tsx` extension (e.g., `DashboardNav.tsx`, `BalanceCards.tsx`)
- Utility files: camelCase with `.ts` extension (e.g., `use-dashboard.ts`, `balance-cards.tsx`)
- Type/interface files: `index.ts` in `types/` directory containing all shared types
- Hooks: `use-[feature].ts` pattern (e.g., `use-dashboard.ts`, `use-accounts.ts`, `use-transactions.ts`)

**Functions:**
- Async handlers: `POST`, `GET`, `PATCH`, `DELETE` for API routes (uppercase, exported)
- Utility functions: camelCase (e.g., `formatCurrency()`, `normalizeMerchantName()`, `calculateFrequency()`)
- React component functions: PascalCase (e.g., `DashboardNav()`, `BalanceCards()`, `Button()`)
- Hook functions: camelCase starting with `use` (e.g., `useDashboardSummary()`, `useSpendingTrends()`)
- Helper functions inside files: camelCase (e.g., `getSession()`, `checkLoginRateLimit()`)

**Variables:**
- Constants at module/file level: camelCase lowercase (e.g., `navItems`, `sessionOptions`, `fetcher`)
- Configuration objects: camelCase (e.g., `sessionOptions`, `configuration`, `buttonVariants`)
- React state and hooks: camelCase (e.g., `pathname`, `router`, `data`, `isLoading`)
- Destructured props: camelCase (e.g., `className`, `variant`, `size`)
- Database schema properties: camelCase (e.g., `accountId`, `institutionId`, `plaidAccessToken`)

**Types:**
- Interfaces: PascalCase (e.g., `SessionData`, `ApiError`, `DashboardSummary`, `AccountSummary`, `TransactionItem`)
- Type names: PascalCase (e.g., `ButtonProps`, `VariantProps`)
- Exported type declarations: PascalCase with `export interface` or `export type`

## Code Style

**Formatting:**
- ESLint: `eslint` ^8.57.1 with Next.js config (`eslint-config-next` ^14.2.35)
- No explicit `.prettierrc` config - using Next.js ESLint defaults
- Indentation: 2 spaces (observed in all files)
- Line length: No explicit limit enforced, but files kept under 150 chars per line typically
- Semicolons: Always present (required)
- Quotes: Double quotes for strings, single quotes not used

**Linting:**
- Tool: `next lint` command from package.json
- Uses Next.js ESLint plugin configuration
- Strict mode: TypeScript `strict: true` in tsconfig.json

## Import Organization

**Order:**
1. External libraries and frameworks (React, Next.js, third-party packages)
2. Internal utilities and helpers (`@/lib/...`)
3. Internal types (`@/types`)
4. Internal components (`@/components/...`)
5. Hooks (`@/hooks`)

**Path Aliases:**
- `@/*` maps to project root - allows `@/lib/`, `@/components/`, `@/hooks/`, `@/types/`
- Configured in `tsconfig.json` with `"paths": { "@/*": ["./*"] }`
- Used consistently across all files

**Example from `components/dashboard/nav.tsx`:**
```typescript
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, ... } from "lucide-react";
```

## Error Handling

**Patterns:**
- API routes: Try-catch blocks wrapping all async operations
- Error typing: `error: unknown` - explicit unknown type annotation
- Error messages: `error instanceof Error ? error.message : "fallback message"`
- HTTP responses: Return `NextResponse.json({ error: message }, { status: code })`
- Client errors: 400 (Bad Request), 401 (Unauthorized), 429 (Rate Limited)
- Server errors: 500 (Internal Server Error)

**Example from `app/api/dashboard/summary/route.ts`:**
```typescript
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : "Failed to fetch dashboard summary";
  return NextResponse.json({ error: message }, { status: 500 });
}
```

**Validation:**
- Use Zod for schema validation on API inputs
- Call `safeParse()` to handle invalid data gracefully
- Return 400 status with descriptive error for validation failures

**Example from `app/api/auth/login/route.ts`:**
```typescript
const parsed = loginSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json({ error: "Password is required" }, { status: 400 });
}
```

## Logging

**Framework:** `console` (browser/Node.js built-in)

**Patterns:**
- Minimal debug logging observed (one instance in `app/api/auth/login/route.ts`)
- WARNING: Debug log with `console.log("DEBUG hash:", JSON.stringify(passwordHash));` - remove before production
- No structured logging library (like Winston, Pino) detected
- Logs appear to be ad-hoc during development

**Guidance:**
- Use `console.log()` sparingly for debugging
- Remove debug logs before committing
- For production logging, consider adding structured logging (currently missing)

## Comments

**When to Comment:**
- Inline comments rare in codebase
- Explanatory comments used for non-obvious algorithms (e.g., frequency calculation in `lib/recurring.ts`)
- Comments in database schema explain field meaning (e.g., "AES-256-GCM encrypted")

**JSDoc/TSDoc:**
- Not consistently used
- Type definitions in interfaces provide documentation
- Function parameters and return types are strongly typed (avoiding need for JSDoc)

**Example from `lib/db/schema.ts`:**
```typescript
plaidAccessToken: text("plaid_access_token").notNull(), // AES-256-GCM encrypted
```

## Function Design

**Size:**
- Most functions 20-60 lines
- Utility functions can be 5-15 lines
- API route handlers typically 30-80 lines including error handling
- React components: 20-100 lines depending on complexity

**Parameters:**
- Prefer named parameters (object destructuring) for functions with multiple params
- Use optional parameters with defaults (e.g., `days: number = 90`)
- Type all parameters explicitly with TypeScript types

**Example from `lib/projections.ts`:**
```typescript
export async function getProjections(
  days: number = 90
): Promise<ProjectedExpense[]> {
```

**Return Values:**
- Always type return values explicitly
- Return early from functions to reduce nesting
- Use null-coalescing (`??`) and optional chaining (`?.`) for safe property access

**Example from `components/dashboard/nav.tsx`:**
```typescript
async function handleLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
  router.push("/login");
  router.refresh();
}
```

## Module Design

**Exports:**
- Named exports preferred (not default exports in most cases)
- Example: `export function formatCurrency(amount: number): string`
- Components exported as named exports (e.g., `export function Button(...)`)
- Utilities in `lib/utils.ts` exported individually

**Barrel Files:**
- Not used in this project
- Each file exports its own functionality directly
- Types centralized in `types/index.ts` (single barrel for all types)

**File Organization:**
- One component per file in `components/` directory
- One hook per file in `hooks/` directory
- Related utilities grouped by feature in `lib/` subdirectories (e.g., `lib/auth/`, `lib/db/`, `lib/plaid/`)
- Each `route.ts` is a single API endpoint handler

---

*Convention analysis: 2026-02-13*
