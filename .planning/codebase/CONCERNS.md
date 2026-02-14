# Codebase Concerns

**Analysis Date:** 2026-02-13

## Security Issues

**Debug Logging of Sensitive Data:**
- Issue: Password hash is logged to console in production code
- Files: `app/api/auth/login/route.ts:35`
- Impact: Sensitive authentication data exposed in server logs, visible to anyone with log access
- Fix approach: Remove `console.log("DEBUG hash:", JSON.stringify(passwordHash))` immediately. Use structured logging in development only with conditional checks for NODE_ENV

**Webhook Signature Verification Error Handling:**
- Issue: Webhook verification failures silently return false without distinguishing between network errors and invalid signatures
- Files: `lib/plaid/webhooks.ts:62-63`
- Impact: Network errors during webhook verification could cause legitimate webhooks to be rejected; attacker can exploit vague error handling
- Fix approach: Log specific verification failures separately (key fetch failures, JWK parsing errors, signature validation errors) and respond with 401 only when signature is provably invalid. Network errors should retry or alert operators

**Single-User Password in Environment:**
- Issue: Single bcrypt hash for all authentication; no per-user credentials
- Files: `app/api/auth/login/route.ts`, `.env.example`
- Impact: Compromise of environment variable exposes all authentication. No audit trail of which instance accessed the app
- Fix approach: Consider implementing proper user management with individual credentials if multi-user access becomes needed. Current approach acceptable for single-user but document the security posture clearly

**Rate Limiting Uses In-Memory Store:**
- Issue: `rate-limiter-flexible` configured with RateLimiterMemory (in-process) rather than distributed store
- Files: `lib/auth/rate-limit.ts:1-6`
- Impact: Rate limits reset on app restart; horizontal scaling would require separate rate limit bypass per instance
- Fix approach: For production with single instance acceptable. For scale, migrate to Redis-based store: `new RateLimiterRedis({ client: redisClient, points: 5, duration: 900 })`

## Tech Debt & Maintainability

**Sync Operation Has No Transaction Boundaries:**
- Issue: `lib/plaid/sync.ts` processes transactions in separate DB calls without wrapping in a transaction
- Files: `lib/plaid/sync.ts:74-162`
- Impact: If sync fails midway (e.g., after processing 100 transactions but failing on balance snapshot), database is left in inconsistent state. Next sync may skip transactions or create duplicates
- Fix approach: Wrap `syncTransactions` and `syncBalances` in a database transaction. On error, rollback both operations together:
  ```typescript
  await db.transaction(async (tx) => {
    await syncTransactions(institutionId, accessToken, cursor, tx);
    await syncBalances(institutionId, accessToken, tx);
  });
  ```

**Encryption Key Validation Only Checks Length, Not Format:**
- Issue: `lib/crypto.ts` validates ENCRYPTION_KEY length (64 hex chars) but doesn't validate it's valid hex before converting
- Files: `lib/crypto.ts:12-15`
- Impact: Invalid hex characters in key string will fail silently or throw unclear errors. Development delays due to unclear error messages
- Fix approach: Add explicit hex validation: `if (!/^[0-9a-f]{64}$/i.test(key)) throw new Error("ENCRYPTION_KEY must be 64 hex characters")`

**Transaction Sync Missing Cursor Error Recovery:**
- Issue: `syncTransactions` while loop has no maximum iteration limit
- Files: `lib/plaid/sync.ts:74-162`
- Impact: If Plaid API returns `has_more: true` indefinitely or cursor-related bugs exist, sync job hangs consuming all resources
- Fix approach: Add safety limit: `let iterations = 0; while (hasMore && iterations < 1000) { ... iterations++; }`

**Frequency Detection Logic Fragile to Edge Cases:**
- Issue: `calculateFrequency` in `lib/recurring.ts` uses fixed thresholds (intervals <= 10 for weekly, etc.) which break for transactions near month boundaries or with timezone issues
- Files: `lib/recurring.ts:20-60`
- Impact: Monthly transactions (28-31 days apart) fail to classify; user sees no recurring pattern detected even for obvious recurring charges
- Fix approach: Restructure logic to detect "monthly-like" patterns. Instead of fixed 30-day threshold, accept 25-35 day intervals for monthly classification:
  ```typescript
  } else if (avgInterval <= 45) {
    const allWithinRange = intervals.every((d) => d >= 25 && d <= 35);
    if (allWithinRange) return { frequency: "monthly", intervalDays: 30 };
  }
  ```

**No Error Recovery for Failed Institution Syncs:**
- Issue: When one institution sync fails in `syncAllInstitutions`, errors are caught but logged then discarded. No retry mechanism or exponential backoff
- Files: `lib/plaid/sync.ts:210-229`, `scripts/cron.ts`
- Impact: Transient network errors cause user's accounts to show stale data until next sync window (24 hours later). Users don't know sync failed
- Fix approach: Implement exponential backoff retry within cron job:
  ```typescript
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await syncInstitution(inst.id);
      break;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  ```

**Webhook Processing Fire-and-Forget Without Monitoring:**
- Issue: `app/api/webhooks/plaid/route.ts:24-26` calls `handleWebhook` without await, then logs errors but doesn't track failure
- Files: `app/api/webhooks/plaid/route.ts:24-26`
- Impact: Webhook processing errors silently lost; user's transactions not synced but no indication to developer/operator
- Fix approach: Implement basic webhook failure logging to database or log aggregation service. Add monitoring alerting on webhook failure rate

**No Database Connection Pooling Configuration:**
- Issue: `lib/db/index.ts` instantiates postgres client without explicit pool configuration
- Files: `lib/db/index.ts:1-8`
- Impact: Default pool size (10 connections) may be insufficient under load; connection exhaustion causes request timeouts
- Fix approach: Explicitly configure pool:
  ```typescript
  const client = postgres(connectionString, {
    max: 25,
    connection: { application_name: "finance-dashboard" }
  });
  ```

## Scaling & Performance

**Daily Sync Runs Sequentially Per Institution:**
- Issue: `syncAllInstitutions` loops through institutions one at a time with no parallelization
- Files: `lib/plaid/sync.ts:210-229`
- Impact: With 10+ institutions, sync window can exceed allocated time. If one slow institution blocks, others aren't synced on schedule
- Fix approach: Implement parallel processing with concurrency limit:
  ```typescript
  const pLimit = require("p-limit");
  const limit = pLimit(5); // 5 concurrent syncs
  const promises = allInstitutions.map(inst =>
    limit(() => syncInstitution(inst.id))
  );
  const results = await Promise.allSettled(promises);
  ```

**Recurring Detection Runs Full Scan on Every Sync:**
- Issue: `detectAllRecurring` (called after every sync) fetches all transactions for all accounts to detect recurring patterns
- Files: `lib/plaid/webhooks.ts:93`, `lib/recurring.ts:156-165`
- Impact: With thousands of transactions, detection becomes O(n²) or worse. Weekly/monthly syncs will be slow
- Fix approach: Only run detection on accounts that received new transactions in current sync, and use incremental update logic

**No Pagination in Transaction Processing During Sync:**
- Issue: `syncTransactions` loads all accounts into memory and iterates through all Plaid transactions
- Files: `lib/plaid/sync.ts:56-162`
- Impact: With 10,000+ transactions in single sync window, memory usage spikes and query time compounds
- Fix approach: Process transactions in batches, flushing to DB periodically rather than holding all in memory

**Balance Snapshots Daily Without Deduplication:**
- Issue: Balance snapshots are upserted daily by date, but if sync runs twice in same day, queries both instances
- Files: `lib/plaid/sync.ts:192-207`
- Impact: Minimal but wasteful database writes on duplicate syncs same day
- Fix approach: Add early return if snapshot already exists for today:
  ```typescript
  const existing = await db
    .select()
    .from(balanceSnapshots)
    .where(and(eq(balanceSnapshots.accountId, dbAccount.id), eq(balanceSnapshots.snapshotDate, today)));
  if (existing.length > 0) continue; // Skip snapshot already taken today
  ```

## Test Coverage Gaps

**No Error Tests for Crypto Module:**
- What's not tested: Decryption with invalid format, truncated ciphertext, mismatched auth tags
- Files: `lib/crypto.ts`
- Risk: Silent data corruption on edge cases; users discover during recovery
- Priority: Medium - encryption is critical path

**No API Route Tests:**
- What's not tested: All `/api/` routes have no unit/integration tests
- Files: `app/api/**/*.ts`
- Risk: Regressions in auth, rate limiting, data filtering go undetected
- Priority: High - these are user-facing

**No Recurring Detection Unit Tests:**
- What's not tested: Frequency calculation edge cases (month boundaries, leap years, timezone shifts)
- Files: `lib/recurring.ts`
- Risk: Users report "detection not working" on certain patterns
- Priority: High - affects feature reliability

**No Database Migration Tests:**
- What's not tested: Schema changes, drizzle-kit push/migrate workflows
- Files: `drizzle.config.ts`
- Risk: Production deployment fails with migration errors
- Priority: Medium - deployment blocker

## Missing Critical Features

**No Backup/Restore Process Automation:**
- Problem: README documents backup strategy but no runnable backup script included; manual pg_dump required
- Files: README.md (lines 131-151), no actual script in repo
- Blocks: Disaster recovery on production instance
- Fix approach: Create `scripts/backup.sh` and `scripts/restore.sh` with proper error handling and monitoring

**No Health Check Endpoint:**
- Problem: No `/health` or `/ready` endpoint for Kubernetes/monitoring probes
- Files: No health check routes
- Blocks: Load balancer can't detect failed app instances; container orchestration impossible
- Fix approach: Create `app/api/health/route.ts`:
  ```typescript
  export async function GET() {
    const health = await db.select().from(institutions).limit(1);
    return NextResponse.json({ status: health ? "ok" : "degraded" });
  }
  ```

**No Audit Logging:**
- Problem: No record of password changes, account linkages, or data access
- Files: No audit log schema or implementation
- Blocks: Security investigation after breach; compliance requirements
- Fix approach: Add audit_logs table and log all sensitive operations:
  ```sql
  CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    action VARCHAR,
    resource_type VARCHAR,
    resource_id VARCHAR,
    timestamp TIMESTAMP,
    details JSONB
  );
  ```

**No Session Invalidation/Logout Cleanup:**
- Problem: Sessions stored in httpOnly cookies only; no server-side session store or revocation list
- Files: `lib/auth/session.ts`, `app/api/auth/logout/route.ts`
- Blocks: Stolen cookies can't be revoked until expiration (8 hours)
- Fix approach: Maintain blacklist of revoked session tokens in database on logout

**No Rate Limiting on Data-Fetching Endpoints:**
- Problem: `/api/transactions`, `/api/accounts`, etc. have no per-user rate limits
- Files: `app/api/transactions/route.ts`, `app/api/accounts/route.ts`
- Blocks: Single user can hammer endpoints causing DoS
- Fix approach: Apply same rate-limiter-flexible pattern to all API routes:
  ```typescript
  const readRateLimiter = new RateLimiterMemory({ points: 100, duration: 60 });
  await readRateLimiter.consume("user-id", 1);
  ```

## Dependencies at Risk

**Drizzle-Kit Not Locked to Exact Version:**
- Risk: `drizzle-kit ^0.31.9` can bump to 0.32.0 introducing breaking changes in schema generation
- Impact: `npm run db:generate` or `db:push` fails silently on production deploy
- Migration plan: Pin to exact version: `"drizzle-kit": "0.31.9"`

**Plaid SDK Major Upgrades:**
- Risk: `plaid ^28.0.0` can jump to v29+ with API changes
- Impact: Webhook handling, endpoint signatures change; code breaks without notice
- Migration plan: Evaluate v29+ quarterly; test in staging before upgrading

**iron-session Cookie Encryption:**
- Risk: iron-session may change cookie format or default encryption in minor versions
- Impact: Users logged in with old cookie format can't access app after upgrade
- Migration plan: Consider session migration endpoint to upgrade old sessions on login

## Fragile Areas

**Plaid Institution Status Machine:**
- Files: `lib/db/schema.ts:21`, `lib/plaid/sync.ts:41-50`, `lib/plaid/webhooks.ts:99-116`
- Why fragile: Status values (`active`, `error`, `relink_required`) are strings with no enum validation. Typos silently create new status values. No state transition diagram enforced
- Safe modification: Add TypeScript enum for status:
  ```typescript
  enum InstitutionStatus {
    ACTIVE = "active",
    ERROR = "error",
    RELINK_REQUIRED = "relink_required",
  }
  ```
- Test coverage: Missing validation tests for status transitions; no tests for invalid status values

**Numerical Precision in Financial Calculations:**
- Files: `lib/plaid/sync.ts:92`, `lib/projections.ts:85`, `lib/recurring.ts:135`
- Why fragile: Amounts stored as numeric strings then parsed to floats for calculations. Floating-point math can introduce rounding errors on large sums
- Safe modification: Use decimal math library for all financial calculations: `import { Decimal } from "decimal.js"`
- Test coverage: No unit tests for edge cases (0.01 cent rounding, large amounts > $1M)

**Middleware Session Expiry Check Duplicated:**
- Files: `middleware.ts:40-50`, `lib/auth/session.ts:35-39`
- Why fragile: Expiry logic defined twice in different places; if one is updated the other becomes stale
- Safe modification: Use single source of truth; export function from session.ts and call from middleware
- Test coverage: No tests verifying both implementations remain in sync

**Transaction Query Pagination Without Sorting Stability:**
- Files: `app/api/transactions/route.ts:78-79`
- Why fragile: Pagination orders by date DESC but ties (multiple transactions same day) may reorder between requests causing duplicate results across pages
- Safe modification: Add stable secondary sort: `.orderBy(desc(transactions.date), desc(transactions.id))`
- Test coverage: No pagination boundary tests

## Configuration & Environment Issues

**Missing NODE_ENV Default:**
- Issue: Code checks `NODE_ENV === "production"` but .env doesn't set NODE_ENV
- Files: `lib/auth/session.ts:14`, `middleware.ts` (implicit assumptions)
- Impact: Session cookies may not be secure in development if NODE_ENV not set; tests run against production settings unexpectedly
- Fix approach: Explicitly set in docker-compose.yml `environment` and default in .env.example: `NODE_ENV=development`

**Database Connection String Format Not Validated:**
- Issue: `DATABASE_URL` can be invalid postgresql:// URL; no parsing/validation on startup
- Files: `lib/db/index.ts:5`
- Impact: App starts but crashes on first DB access; slow error discovery in production
- Fix approach: Add validation on app startup:
  ```typescript
  const url = new URL(process.env.DATABASE_URL!);
  if (url.protocol !== "postgresql:") throw new Error("Invalid DATABASE_URL");
  ```

**Cron Script Not Integrated into Main App:**
- Issue: `scripts/cron.ts` must be run separately; if not started, no automatic syncs happen
- Files: `scripts/cron.ts`, `docker/Dockerfile` (not used)
- Impact: User deploys app, forgets to start cron, accounts never update automatically
- Fix approach: Move cron scheduling into app initialization or document prominently that cron must be started separately

---

*Concerns audit: 2026-02-13*
