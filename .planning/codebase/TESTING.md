# Testing Patterns

**Analysis Date:** 2026-02-13

## Test Framework

**Runner:**
- Not detected - no test framework configured
- No Jest, Vitest, or other test runner found
- No test scripts in package.json

**Assertion Library:**
- Not applicable - testing not implemented

**Run Commands:**
- No test commands available
- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run lint` - ESLint only

## Test File Organization

**Location:**
- No test files exist in project source
- All test files detected are in `node_modules` (dependency test suites)
- No `__tests__`, `tests/`, or `*.test.ts` files in `app/`, `lib/`, `components/`, or `hooks/` directories

**Naming:**
- Not applicable - testing not implemented

**Structure:**
- Not applicable - testing not implemented

## Test Structure

**Critical Gap:**
This project has **zero test coverage**. No unit, integration, or end-to-end tests are implemented.

**Impact:**
- API routes have no validation tests
- Database queries untested
- Business logic (frequency detection, projections) untested
- UI components untested
- Authentication flow untested

## Mocking

**Framework:**
- Not applicable - testing not implemented

**Patterns:**
- Not applicable - testing not implemented

**What to Mock:**
- When testing is added, should mock:
  - External API calls (Plaid API, database queries)
  - Session/authentication
  - Environment variables
  - Fetch requests in hooks

**What NOT to Mock:**
- Utility functions (formatCurrency, formatDate, etc.)
- Pure calculations (frequency detection logic)
- Component rendering (prefer integration tests)

## Fixtures and Factories

**Test Data:**
- Not implemented

**Location:**
- Not applicable

## Coverage

**Requirements:**
- None enforced - no test setup

**Current Status:**
- 0% coverage
- No coverage tracking tool configured

## Test Types

**Unit Tests:**
- Not implemented
- Should cover:
  - `lib/utils.ts` - formatting functions
  - `lib/recurring.ts` - frequency calculation algorithm
  - `lib/projections.ts` - expense projection logic
  - `lib/crypto.ts` - encryption/decryption utilities

**Integration Tests:**
- Not implemented
- Should cover:
  - API routes with database operations
  - Authentication flow (login/logout)
  - Plaid integration (exchange token, sync)
  - Dashboard data aggregation

**E2E Tests:**
- Not implemented
- Not configured (no Cypress, Playwright, etc.)
- Should test user journeys:
  - Login → Dashboard view
  - Account linking via Plaid
  - Transaction viewing and filtering
  - Settings management

## Common Patterns

**When Testing is Added:**

**Async Testing:**
- API route handlers are all async
- Need to test Promise resolution and rejection
- Example: Testing `POST /api/auth/login` with various password inputs

**Error Testing:**
- All API routes have try-catch blocks
- Should test error cases return correct HTTP status codes:
  - 400 for validation failures
  - 401 for auth failures
  - 429 for rate limiting
  - 500 for server errors

**Example test structure (if implemented):**
```typescript
// Example: would test app/api/auth/login/route.ts
describe('POST /api/auth/login', () => {
  it('should reject invalid password', async () => {
    const response = await POST(createRequest({ password: 'wrong' }));
    expect(response.status).toBe(401);
  });

  it('should rate limit after multiple failures', async () => {
    // Multiple failed attempts should return 429
  });

  it('should set session on success', async () => {
    // Verify session.isLoggedIn = true after valid password
  });
});
```

## Recommended Testing Strategy

**Phase 1 - Unit Tests:**
1. Set up Jest or Vitest
2. Test utility functions (high ROI, low complexity)
3. Test business logic in `lib/` files
4. Aim for 80%+ coverage of pure functions

**Phase 2 - Integration Tests:**
1. Test API routes with mocked database
2. Test authentication flow
3. Test data aggregation logic
4. Test Plaid integration points

**Phase 3 - E2E Tests:**
1. Add Playwright or Cypress
2. Test critical user journeys
3. Test dashboard workflows
4. Test account linking flow

**Configuration Recommendations:**
- Add Jest or Vitest to devDependencies
- Create `jest.config.js` or `vitest.config.ts`
- Add test script to package.json: `"test": "jest"` or `"test": "vitest"`
- Create `__tests__` directories parallel to source
- Use environment file for test database connection

---

*Testing analysis: 2026-02-13*

**CRITICAL:** This codebase lacks any automated tests. Test coverage is 0%. Consider prioritizing test implementation for:
- Sensitive code (authentication, rate limiting)
- Complex business logic (frequency calculation, projections)
- API endpoints (all routes untested)
