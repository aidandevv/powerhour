# Testing

Powerhour uses unit and route tests for fast feedback, PostgreSQL integration
tests for persistence and query views, and Playwright for browser flows.
Default model tests use deterministic HTTP fixtures rather than external AI.

## Commands

```bash
npm test                    # Vitest; database suites skip without TEST_DATABASE_URL
npm run test:unit           # excludes tests/integration and e2e
npm run test:integration    # model HTTP tests plus opt-in database suites
npm run test:coverage       # terminal, HTML, LCOV, and JSON coverage reports
npm run test:e2e:install    # installs Chromium for Playwright
npm run test:e2e            # demo-mode browser suite; requires a test database
```

Run these from the repository root. See the
[contribution guide](../CONTRIBUTING.md#validation) for the complete delivery
pipeline, including lint, types, build, and dependency audit.

## Disposable database setup

First start the development database using the
[README quick start](../README.md#quick-start). With its default database role,
create a separate database:

```bash
docker exec powerhour-dev-db createdb -U finance_app powerhour_test
```

Set `TEST_DATABASE_URL` in your shell, using the same username, URL-encoded
password, and loopback port as the working development `DATABASE_URL`, but
changing its database name to `powerhour_test`. Replace the password placeholder:

```bash
export TEST_DATABASE_URL='postgresql://finance_app:YOUR_URL_ENCODED_DB_PASSWORD@127.0.0.1:5432/powerhour_test'
DATABASE_URL="$TEST_DATABASE_URL" DATABASE_SSL=disable node scripts/migrate.mjs
npm run test:integration
npm run test:coverage

npm run test:e2e:install
PLAYWRIGHT_DATABASE_URL="$TEST_DATABASE_URL" npm run test:e2e
```

Use a dedicated database whose name ends in `_test`. The integration and
browser setup guards reject other names. These suites truncate and reseed
fixtures, so never point them at a database containing data you want to retain.
Run integration and browser suites sequentially if they share a database.
Vitest database suites also run serially when `TEST_DATABASE_URL` is present.

The migration script reads the process environment, not `.env` automatically.
`TEST_DATABASE_URL` must be exported for Vitest; setting it only in a local
`.env` file does not enable database integration tests.

## Test boundaries

| Location | Scope |
| --- | --- |
| `lib/**/__tests__/` | Crypto, PII masking, Plaid verification, calculations, and module behavior. |
| `app/**/__tests__/` | Routes and components with external dependencies mocked. |
| `scripts/__tests__/` | Setup configuration, secret generation, and environment serialization. |
| `tests/integration/` | Real PostgreSQL constraints and views; AI SDK requests through a model HTTP fixture. |
| `e2e/` | Authenticated demo UI flows using synthetic data and a local model fixture. |

Playwright starts a development app and model fixture by default. It does not
call Plaid or Gemini. Advanced overrides live in
[playwright.config.ts](../playwright.config.ts); setting `PLAYWRIGHT_BASE_URL`
uses an existing server instead of starting either local service. That server
must use the expected synthetic dataset and compatible provider configuration.

## Local-model Beta validation

Ticker, Budget Planner, PDF report summaries, smart budget goals, and weekly
digests share provider configuration. All five local-model surfaces display
**Beta**; PDF summaries and saved digests retain a beta marker. Settings lists
the configured model for each feature without exposing credentials or the
server URL.

[local-model.test.ts](../tests/integration/local-model.test.ts) uses the real
AI SDK against a deterministic OpenAI-compatible HTTP server. It checks HTTP
failures and timeouts without credentials. With `TEST_DATABASE_URL`, it also
exercises both streaming agents and tool follow-ups, goal validation and
persistence with and without structured outputs, PDF generation, and saved
digests.

Playwright covers beta labels, streaming chat and planner flows, goal
regeneration, PDF downloads, and authenticated provider metadata. Neither an
installed model nor an external AI service is needed for repeatable coverage.

### Installed-model smoke test

With the disposable database migrated and `TEST_DATABASE_URL` exported, opt in
to a live model using synthetic data:

```bash
LOCAL_MODEL_SMOKE_URL=http://127.0.0.1:11434/v1 \
  LOCAL_MODEL_SMOKE_ID=your-installed-model \
  npx vitest run tests/integration/local-model.live.test.ts
```

Replace the model identifier with one installed on your server. The live suite
skips unless all three variables are supplied. It checks tool execution and
readable responses for both agents, three schema-valid goals, a PDF, and a saved
digest. Each generation has a three-minute limit. This establishes basic
compatibility, not answer quality or financial accuracy.

## Coverage and CI evidence

[vitest.config.ts](../vitest.config.ts) reports coverage across application,
component, and library sources, plus TypeScript scripts. It enforces thresholds
for selected critical modules, including the shared model factory, crypto,
savings projections, and savings targets. These are module-specific gates,
not a repository-wide 100% coverage claim.

GitHub Actions runs for pull requests and pushes to `dev`, `stable`, and `main`,
plus manual dispatch. It provisions disposable PostgreSQL, runs deterministic
integration and browser tests, and checks the application build and container
configuration. It uploads coverage, JUnit results, and available Playwright
traces, screenshots, and videos for 14 days. Live-model smoke tests are opt-in
and are not part of default CI.

Add the narrowest meaningful test for a behavior's risk. Authentication,
encrypted data, money and date calculations, Plaid sync and webhook verification,
and access-control boundaries require focused coverage. Report skipped database
or live-model suites explicitly when describing validation results.
