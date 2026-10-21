# Testing

Powerhour uses a risk-based test pyramid. Unit and route tests keep feedback fast, database integration tests verify the PostgreSQL security boundary, and Playwright exercises the user-visible demo flow.

## Commands

```bash
npm test                    # all Vitest tests; DB tests skip without TEST_DATABASE_URL
npm run test:unit           # fast tests only
npm run test:integration    # requires a disposable PostgreSQL database
npm run test:coverage       # HTML, LCOV, JSON, and terminal coverage reports
npm run test:e2e:install    # install local Chromium for Playwright
npm run test:e2e            # demo-mode browser smoke suite
```

For integration and E2E work, create a dedicated database whose name ends in `_test`, then run migrations. The integration harness refuses any other database name:

```bash
docker compose -f docker/docker-compose.yml up db -d
docker compose -f docker/docker-compose.yml exec db createdb -U finance_app powerhour_test
DATABASE_URL=postgresql://finance_app:finance_app@127.0.0.1:5432/powerhour_test \
  DATABASE_SSL=disable node scripts/migrate.mjs
TEST_DATABASE_URL=postgresql://finance_app:finance_app@127.0.0.1:5432/powerhour_test \
  npm run test:integration
```

`TEST_DATABASE_URL` is intentionally required by the integration tests, and its database name must end in `_test`. The harness truncates only this explicitly configured, dedicated database.

## Test boundaries

- `lib/**/__tests__` — unit and module-integration behavior, including crypto, PII, Plaid verification, and financial calculations.
- `app/**/__tests__` — route and component behavior with mocked external services.
- `tests/integration` — a real migrated PostgreSQL database, including schema constraints and security views.
- `e2e` — Playwright browser flows against deterministic demo data. Plaid and Gemini are never called.

## Local model Beta validation

Ticker, Budget Planner, report summaries, smart budget goals, and weekly digests share the same provider configuration. Local-model entry points show **Beta**, and Settings → AI models lists their per-feature model selections. Report summaries and saved digests retain a beta marker.

`tests/integration/local-model.test.ts` uses the real AI SDK against a deterministic OpenAI-compatible HTTP server. It checks server failures and timeouts without credentials. With `TEST_DATABASE_URL`, it also exercises both streaming agents and their tool follow-ups, goal validation/persistence with and without structured outputs, real PDF generation, and saved digests. Database suites run serially to prevent concurrent truncation.

Playwright starts its own model fixture and tests all beta surfaces, streaming chat/planner, goal regeneration, PDF downloads, and authenticated provider metadata. It needs the migrated disposable database described above. No installed model or external AI service is needed for these repeatable checks.

To smoke test an installed model with synthetic data, explicitly opt in:

```bash
TEST_DATABASE_URL=postgresql://finance_app:finance_app@127.0.0.1:5432/powerhour_test \
  LOCAL_MODEL_SMOKE_URL=http://127.0.0.1:11434/v1 \
  LOCAL_MODEL_SMOKE_ID=your-installed-model \
  npx vitest run tests/integration/local-model.live.test.ts
```

The live smoke suite skips unless all three variables are supplied. It checks real tool execution and readable responses for both agents, three schema-valid goals, a PDF, and a stored digest. It allows three minutes per generation; this is a compatibility smoke check, not an answer-quality evaluation.

## CI evidence

Pull requests produce LCOV/HTML coverage, JUnit results, and Playwright failure traces, screenshots, and videos. The suite begins by publishing an honest full-source coverage baseline; once that baseline has run on the default branch, set no-regression and critical-path thresholds rather than an arbitrary repository-wide percentage.

Every new behavior should include the narrowest test layer that exercises its real risk. Changes to authentication, encrypted data, money/date calculations, Plaid webhooks and sync, or access-control boundaries require tests.
