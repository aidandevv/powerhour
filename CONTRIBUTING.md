# Contributing to powerhour

Start with the [README](README.md#quick-start) for a working Node.js setup,
PostgreSQL, migrations, and provider configuration. Use demo mode and synthetic
data for development unless a task specifically requires real integrations.

## Branch and pull request flow

Create a focused working branch from the current `dev` branch:

```bash
git fetch origin
git switch dev
git pull --ff-only origin dev
git switch -c feat/short-description
```

Use lowercase kebab-case branches such as `feat/local-model-support` or
`fix/session-expiry`. Use conventional commits, for example
`fix(auth): reject expired sessions` or `docs: clarify database setup`.

- Working branches target `dev` through a pull request and squash merge.
- Promote `dev` to `stable`, then `stable` to `main`, through pull requests
  using merge commits. `main` is the production source of truth.
- Keep each pull request focused. Explain the problem, resulting behavior,
  relevant validation, and material limitations.
- Delete working branches after merge. Release tags use Semantic Versioning
  and originate from `main`.

Never commit secrets, local environment files, real financial data, generated
coverage, browser artifacts, or machine-specific configuration.

## Project structure

| Path | Responsibility |
| --- | --- |
| `app/(auth)/` | Login flow. |
| `app/(dashboard)/` | Protected dashboard pages. |
| `app/api/` | Server-side API routes. |
| `components/` | Shared UI, charts, chat, and planner components. |
| `lib/agent/` | Agent prompts, tools, and PII masking. |
| `lib/ai/` | Shared model configuration, reports, and budget goals. |
| `lib/digest/` | Weekly digest generation and retrieval. |
| `lib/db/` | Drizzle schema, query views, and SQL migrations. |
| `lib/plaid/` | Financial provider integration and sync. |
| `scripts/` | Setup, migrations, and maintenance commands. |
| `tests/integration/` and `e2e/` | Database, model HTTP, and browser validation. |
| `docker/` and `deploy/` | Source-build and release-image deployment layouts. |

The app uses Next.js 16 and React 19. Read the installed Next.js documentation
in `node_modules/next/dist/docs/` before changing framework-specific behavior;
do not assume older Next.js conventions still apply.

## Validation

Run the delivery checks before submitting application changes:

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
npm audit --omit=dev --audit-level=high
```

For browser behavior, also install Chromium and run `npm run test:e2e`.
Database, container, workflow, and release changes also need a disposable
database, validation of both Compose files, and a Docker image build where
supported. Use [docs/TESTING.md](docs/TESTING.md) for exact setup and test tiers.
Report skipped checks and failures explicitly; do not describe skipped database
suites as passing integration coverage.

Add tests at the narrowest layer that exercises the behavior's actual risk.
Authentication, encryption, financial calculations, Plaid verification, and
access-control changes require focused coverage. Documentation-only changes
should verify their commands, links, and implementation claims.

GitHub Actions runs application and container checks for pull requests and
pushes to `dev`, `stable`, and `main`. Passing local checks does not replace CI.

## Implementation conventions

- Keep TypeScript strict; avoid unchecked casts and unvalidated external input.
- Use existing UI components, tokens, and accessibility patterns. Handle
  loading, empty, error, and streaming states where relevant.
- Keep secrets and database access server-side. Never prefix credentials with
  `NEXT_PUBLIC_`.
- Use the shared model factory in `lib/ai/model.ts` for AI features. Preserve
  per-feature overrides, limits, name masking, and provider-aware beta labels.
- Keep **all five local-model features tagged Beta**, including generated
  report summaries and stored digests. Provider configuration status must not
  imply that connectivity or response quality has been verified.
- Follow existing tools in `lib/agent/tools/`; use descriptive snake_case tool
  names, validated inputs, bounded queries, and the appropriate query views.
  Tools that persist changes need an explicit user-confirmation flow.
- Keep financial calculations in testable server modules. Handle currency,
  rounding, dates, and empty datasets consistently with existing helpers.
- Review dependency additions for necessity, licensing, and deployment impact.

Local models use Chat Completions. Test multi-step tool responses and structured
output compatibility against the shared fixtures before relying on a particular
installed model. A smoke test demonstrates compatibility, not financial
correctness or answer quality.

## Database changes

Keep `lib/db/schema.ts`, SQL migrations in `lib/db/migrations/`, and the
fresh-install bootstrap in `scripts/migrate.mjs` aligned. The project migration
runner maintains its own `powerhour_migrations` ledger; do not mix migration
runners against the same database.

`npm run db:generate` can generate a migration for review when `DATABASE_URL`
is supplied in the process environment. Inspect the SQL, include any necessary
view updates, and test both an empty installation and an upgrade from the
previous schema. Never edit an already applied migration.

Use the project runner for installation and upgrades:

```bash
node --env-file=.env scripts/migrate.mjs
```

The runner and Drizzle CLI commands do not automatically load `.env`. Do not use
`db:push` as a substitute for reviewing and validating a migration intended
for deployment. Back up data before applying changes to a persistent instance.

## Documentation and security

Update the README and relevant guides when configuration, setup, feature
status, privacy behavior, or deployment requirements change. Keep examples
consistent with `.env.example` and the actual scripts and Compose layouts.

For security-sensitive changes, consider the full data path: session checks,
trusted proxy configuration, validation, encryption, AI prompts, logs, and
provider requests. Query views and name masking reduce exposure but are not
complete isolation or anonymization guarantees. Use synthetic examples when
reporting issues and exclude secrets and financial records from public reports.

The project uses the [ISC license](LICENSE). Follow the
[font policy](docs/FONTS.md) when adding assets.
