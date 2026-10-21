# Security Fix Plan

Date: 2026-06-21

Source scan: Codex Security scan `8c57f103-8c91-4c4b-b3b9-562c5fd68ac5`

## Objectives

Fix the five confirmed audit findings while keeping the finance app's self-hosted deployment model intact. Prioritize server-side secrecy boundaries first, then dependency exposure, replay protection, rate-limit correctness, and AI egress controls.

## Phase 1: Stop Plaid Token Material From Crossing the Server Boundary

Severity: High

Files:
- `app/api/plaid/exchange-token/route.ts`
- `lib/plaid/link.ts`
- `lib/db/schema.ts`

Plan:
1. Change `exchangePublicToken` or the API route to return a safe institution projection instead of the full inserted database row.
2. Exclude at minimum `plaidAccessToken`, `syncCursor`, `plaidItemId`, `errorCode`, and any future internal sync/token fields from the response.
3. Prefer a shared projection helper close to the Plaid/institution boundary so future routes do not accidentally serialize raw rows.
4. Add a regression test for `POST /api/plaid/exchange-token` or the projection helper asserting token/sync fields are absent.

Verification:
- Run the relevant unit/API tests.
- Manually inspect the route response shape in test fixtures or a local mocked Plaid flow.
- Confirm no client component depends on the removed fields.

## Phase 2: Clear the Production Dependency Advisory

Severity: Medium

Files:
- `package.json`
- `package-lock.json`

Plan:
1. Update the dependency graph so production `form-data` resolves to `4.0.6` or newer.
2. Prefer the smallest safe lockfile change first, such as `npm audit fix --omit=dev`, then inspect whether it changes only the Plaid/Axios/FormData chain.
3. If the lockfile cannot resolve cleanly, update the direct `plaid` package to a version whose dependency tree pulls a patched `form-data`.

Verification:
- `npm audit --omit=dev`
- `npm ls form-data`
- Existing test/build checks used for this repo after dependency changes.

## Phase 3: Add Plaid Webhook Freshness and Algorithm Enforcement

Severity: Medium

Files:
- `lib/plaid/webhooks.ts`
- `app/api/webhooks/plaid/route.ts`

Plan:
1. Enforce `alg === "ES256"` while verifying Plaid webhook JWTs.
2. Validate the JWT `iat` claim and reject webhooks older than five minutes.
3. Keep the existing body-hash binding, but compare the expected and actual body hashes with a constant-time comparison.
4. Add tests for valid webhook, stale webhook, wrong algorithm, body-hash mismatch, and missing verification header.

Verification:
- Unit tests for `verifyPlaidWebhook`.
- Confirm the webhook route still returns `200` for verified supported Plaid events and `401` for failed verification.

## Phase 4: Make Rate Limits Trust the Deployment Boundary

Severity: Medium

Files:
- `app/api/auth/login/route.ts`
- `proxy.ts`
- `app/api/ai/chat/route.ts`
- `app/api/ai/budget-planner/route.ts`
- `app/api/ai/report/route.ts`
- `docker/nginx/nginx.conf`

Plan:
1. Add a single server helper for deriving the rate-limit key from a trusted client address.
2. Update nginx to overwrite, not append, `X-Forwarded-For` with `$remote_addr` for the app upstream.
3. Use the helper in login, proxy-level API limits, and AI/report rate limits.
4. Decide the fallback behavior for unknown client IPs. For security, all unknowns should collapse into one constrained bucket rather than unlimited unique buckets.
5. Add tests for spoofed `X-Forwarded-For` values and trusted proxy behavior.

Verification:
- Unit tests for the helper.
- Route tests proving rotating client-supplied `X-Forwarded-For` does not bypass throttling.
- `docker compose config` for nginx/deployment config validity.

## Phase 5: Prevent Private Finance Data From Reaching External Web Search

Severity: Medium

Files:
- `lib/agent/budget-planner-agent.ts`
- `lib/agent/tools/web-search.ts`

Plan:
1. Split budget-planning modes into private finance analysis and public travel/web research, or add a deterministic policy that blocks web search after private finance tools have been used.
2. Add a query guard before `performWebSearch` that rejects account balances, merchant names, subscription names, transaction details, and tool-output derived private data.
3. Keep any allowed web-search queries narrowly scoped to public destination, travel, or benchmark information.
4. Make the policy independent of model instruction-following; do not rely on prompt text alone.
5. Add tests for allowed public queries and blocked private-data queries.

Verification:
- Unit tests for the egress guard/policy state machine.
- Agent/tool tests proving private tool results cannot be passed into `web_search`.
- Manual smoke test of a normal budget-planner flow that still supports safe public research.

## Suggested Implementation Order

1. Phase 1: Plaid exchange response projection.
2. Phase 2: production dependency fix.
3. Phase 3: Plaid webhook replay protection.
4. Phase 4: trusted rate-limit keying.
5. Phase 5: AI web-search egress policy.

This order removes the direct server-boundary leak first, clears the known vulnerable package quickly, then addresses replay, abuse throttling, and model-mediated data egress.

## Final Verification Gate

Before closing the remediation work:

1. Run focused tests added for each fix.
2. Run the repo's standard typecheck, lint, and test suite.
3. Run `npm audit --omit=dev`.
4. Rerun the Codex Security scan or a scoped validation pass over the five fixed findings.
5. Update `docs/dev_journal.md` with the final remediation checkpoint and verification status.

