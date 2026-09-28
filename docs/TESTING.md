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

## CI evidence

Pull requests produce LCOV/HTML coverage, JUnit results, and Playwright failure traces, screenshots, and videos. The suite begins by publishing an honest full-source coverage baseline; once that baseline has run on the default branch, set no-regression and critical-path thresholds rather than an arbitrary repository-wide percentage.

Every new behavior should include the narrowest test layer that exercises its real risk. Changes to authentication, encrypted data, money/date calculations, Plaid webhooks and sync, or access-control boundaries require tests.
