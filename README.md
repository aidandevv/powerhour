# powerhour

A self-hosted, single-user finance dashboard with Plaid account sync, budgeting,
AI assistants, and PDF reports. Use Google Gemini or an OpenAI-compatible model
server, including local inference with Ollama, llama.cpp, or LM Studio.

All five local-model integrations are **Beta**. The quick start below checks
out `dev` for evaluation. The release flow is `dev` → `stable` → `main`, with
`main` as the production source of truth.

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [AI configuration](#ai-configuration)
- [Docker deployment](#docker-deployment)
- [Privacy and security](#privacy-and-security)
- [Development and testing](#development-and-testing)
- [Architecture](#architecture)
- [Contributing and license](#contributing-and-license)

## Features

| Feature | What it provides |
| --- | --- |
| Dashboard | Net worth, account balances, spending trends, credit utilization, and savings progress. |
| Transactions | Search, filters, pagination, and expense groups across linked accounts. |
| Accounts and projections | Balance history, recurring expenses, an expense calendar, and savings projections. |
| Subscription audit | Flags recurring items with no activity for at least 90 days and estimates potential savings. |
| Ticker | Streaming AI chat that queries financial data through tools. **Local model: Beta.** |
| Budget Planner | Travel cost research through DuckDuckGo, savings plans, and spending analysis. **Beta, including local model support.** |
| PDF reports | Financial summaries, tables, charts, and an AI-written narrative. **Local model summaries: Beta.** |
| Smart budget goals | Suggested category caps based on recent spending and comparison with the preceding period. **Local model: Beta.** |
| Weekly digests | Saved AI summaries of spending trends and anomalies. **Local model: Beta.** |
| Settings | Linked institutions, scheduled jobs, password changes, security events, and per-feature AI model status. |

Local-model entry points display beta badges. Generated PDF summaries and saved
local-model digests also carry a beta marker. Model compatibility, tool use,
response times, and output quality vary; review generated financial suggestions.

## Quick start

### Requirements

- Node.js 22 or later and npm.
- Docker Engine or Docker Desktop with Docker Compose v2 for PostgreSQL.
- For real account data: your own [Plaid credentials](https://dashboard.plaid.com).
- For AI features: a [Gemini API key](https://aistudio.google.com/app/apikey) or
  a configured [OpenAI-compatible server](#local-models-beta).

Demo mode needs neither Plaid nor AI credentials to display the dashboard.
AI features still require a configured provider. Powerhour is not affiliated
with Plaid; deployers are responsible for their credentials and API usage.

Run all commands below from the repository root unless stated otherwise.

### 1. Install and configure

```bash
git clone --branch dev https://github.com/aidandevv/powerhour.git
cd powerhour
npm ci
npm run setup
```

Choose **demo** to try synthetic data or **production** for real account data.
The wizard generates database credentials, encryption and session secrets, and
a dashboard password hash in `.env`. Choose **No** if it offers to run migration
and startup commands: those commands target the release Compose layout, while
this checkout uses `docker/docker-compose.yml`.

For this Node.js development setup, edit `.env`:

- Change only the hostname in `DATABASE_URL` from `db` to `127.0.0.1`. Keep the
  generated username, URL-encoded password, port, and database name intact.
- Keep `DATABASE_SSL=disable` for the bundled local database.
- For demo mode, set both `DEMO_MODE=true` and `NEXT_PUBLIC_DEMO_MODE=true`.
- Configure AI using the [provider settings](#ai-configuration) if needed.

Never commit `.env`. If configuring it manually from `.env.example`, generate
all required secrets and single-quote `DASHBOARD_PASSWORD_HASH` so Compose does
not interpret the `$` characters in the bcrypt hash.

### 2. Start a development database

The deployment Compose file keeps PostgreSQL internal. This development-only
command explicitly publishes it on the host loopback interface:

```bash
docker compose --env-file .env --project-name powerhour-dev \
  -f docker/docker-compose.yml run --detach \
  --name powerhour-dev-db --publish 127.0.0.1:5432:5432 db

# Wait until this reports that the database is accepting connections.
docker exec powerhour-dev-db pg_isready -U finance_app -d finance
```

These commands use the wizard's default database user and name. If you changed
them, substitute your configured values. If port 5432 is occupied, choose a
different host port and update `DATABASE_URL` to match.

### 3. Migrate and run

```bash
node --env-file=.env scripts/migrate.mjs
npm run dev
```

Open [localhost:3000](http://localhost:3000). Use the demo login button in demo
mode or your configured password otherwise. The migration script does not load
`.env` itself; `--env-file=.env` supplies it. Next.js loads `.env` for the app.

Stop the development database with `docker stop powerhour-dev-db`; start it
again with `docker start powerhour-dev-db`. Its data persists in the
`powerhour-dev_pgdata` Docker volume.

### Demo behavior

Demo mode seeds synthetic institutions, accounts, transactions, recurring items,
budget goals, and savings targets. It bypasses password verification, makes
Plaid operations no-ops, and disables scheduled jobs. Use a dedicated demo
database and keep it separate from real financial data.

`NEXT_PUBLIC_DEMO_MODE` is a build-time client setting. The supplied Dockerfile
builds with demo UI disabled; changing runtime environment variables alone does
not enable its demo button or banner. Use the Node.js setup above for a complete
demo experience. Restart the development server after changing demo settings.

## AI configuration

Google Gemini is the default provider, with `gemini-3.5-flash-lite` as the default
model. Set `GEMINI_API_KEY` in `.env`; keep it server-side, without a
`NEXT_PUBLIC_` prefix.

The default uses an explicit stable model ID rather than a moving `latest`
alias. `AI_MODEL` and per-feature overrides take precedence, so existing explicit
pins are preserved. Review [Google's model reference](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
and [deprecation schedule](https://ai.google.dev/gemini-api/docs/deprecations)
when updating pins.

### Local models (Beta)

Run a server implementing OpenAI-compatible Chat Completions and load a model
that supports tool calling. Configure `.env`, replacing `your-installed-model`
with the model's actual identifier:

```dotenv
AI_PROVIDER=openai-compatible
AI_BASE_URL=http://localhost:11434/v1
AI_MODEL=your-installed-model
```

This routes **Ticker, Budget Planner, report summaries, smart budget goals,
and weekly digests** through the selected server. All five integrations remain
**Beta**. A Gemini key is unnecessary with this provider. Restart the app after
changing configuration, then check **Settings → AI models** for configuration
status and each feature's model. This status does not test server connectivity.

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | `google` | `google` or `openai-compatible`. |
| `AI_MODEL` | `gemini-3.5-flash-lite` for Google | Required model ID for OpenAI-compatible servers. |
| `AI_BASE_URL` | Unset | OpenAI-compatible base URL, normally ending in `/v1`. |
| `AI_API_KEY` | Unset | Optional bearer token for a server requiring authentication. |
| `AI_MODEL_CHAT`, `AI_MODEL_PLANNER`, `AI_MODEL_REPORT`, `AI_MODEL_GOALS`, `AI_MODEL_DIGEST` | `AI_MODEL` | Optional model override for each feature. |
| `AI_STRUCTURED_OUTPUTS` | `true` | Set `false` if the server rejects JSON Schema response formats for budget goals. |

| Limit | Gemini default | Local-model Beta default |
| --- | --- | --- |
| `AI_CHAT_MAX_STEPS` | 8 | 8 |
| `AI_PLANNER_MAX_STEPS` | 16 | 16 |
| `AI_CHAT_TIMEOUT_MS` | 90000 | 300000 |
| `AI_PLANNER_TIMEOUT_MS` | 120000 | 600000 |
| `AI_REPORT_TIMEOUT_MS` | 15000 | 180000 |
| `AI_GOALS_TIMEOUT_MS` | 30000 | 180000 |
| `AI_DIGEST_TIMEOUT_MS` | 30000 | 180000 |

Explicit limit variables override provider defaults. Longer timeouts do not
guarantee a model can complete the request.

**Ollama context.** Agent prompts and tool schemas need a substantial context
window. Start with at least 16384 tokens if the model and available memory
support it. Configure the Ollama server with
`OLLAMA_CONTEXT_LENGTH=16384 ollama serve`, or set `PARAMETER num_ctx 16384` in a
model's Modelfile. Powerhour does not send `num_ctx` through Chat Completions.
See [Ollama's OpenAI compatibility guide](https://docs.ollama.com/api/openai-compatibility)
and [server configuration](https://docs.ollama.com/faq).

**Docker networking.** A container's `localhost` is the container itself. For a
model server on the host, use
`AI_BASE_URL=http://host.docker.internal:11434/v1`; both Compose files include a
host-gateway mapping. The model server must listen on an interface reachable
from Docker. Restrict access to that interface. On macOS, use native Ollama for
GPU acceleration; Ollama's Docker setup does not support GPU acceleration on
Docker Desktop for macOS. See the [Ollama FAQ](https://docs.ollama.com/faq).

## Docker deployment

Use a reviewed commit from your deployment branch. The commands below build
from source and do not assume a published release image or release assets exist.
See [releases](https://github.com/aidandevv/powerhour/releases) for published
versions; the version in `package.json` alone is not a published release.

### Build and start from source

Install dependencies and run `npm run setup` as described above, choosing
**production** and declining automatic Compose startup. In `.env`:

- Set both demo flags to `false`.
- Use `db` as the `DATABASE_URL` hostname, matching the Compose service.
- Keep database credentials consistent with `POSTGRES_USER`,
  `POSTGRES_PASSWORD`, and `POSTGRES_DB`.
- Set `NEXT_PUBLIC_APP_URL` to your HTTPS URL and configure Plaid and AI.
- Set `TRUSTED_PROXY_HOPS` to the exact number of forwarding proxies in front
  of the app, usually `1` for a single reverse proxy.

```bash
docker compose --env-file .env -f docker/docker-compose.yml build app
docker compose --env-file .env -f docker/docker-compose.yml up -d db
docker compose --env-file .env -f docker/docker-compose.yml \
  run --rm app node scripts/migrate.mjs
docker compose --env-file .env -f docker/docker-compose.yml up -d app

docker compose --env-file .env -f docker/docker-compose.yml ps
curl -fsS http://127.0.0.1:3000/api/health
```

Migrate before starting the app on a fresh database and before starting an
updated version. The source Compose file has no separate `migrate` service;
that service belongs to the [release Compose layout](deploy/docker-compose.yml).
The release layout requires `POWERHOUR_IMAGE` to reference an available image.

The app binds to `127.0.0.1:3000` by default, and PostgreSQL has no published
port. Put an HTTPS reverse proxy in front of the app; production session cookies
are secure cookies. TLS, HSTS, and proxy-level CSP depend on that deployment.
Allow streaming responses without buffering and size upstream timeouts for
the configured AI limits, including the longer local-model Beta defaults.

The optional `tls` Compose profile starts the bundled nginx service. Provision
certificates and update [its configuration](docker/nginx/nginx.conf) for your
domain first. Its existing 180-second upstream timeouts may need increasing
for local models. Configure certificate renewal with your certificate manager.

`TRUSTED_PROXY_HOPS=0` ignores forwarding headers and shares one client rate-limit
bucket. A value higher than the actual proxy count permits client-address
spoofing. Keep the app's direct port inaccessible to untrusted clients when
trusting proxy headers.

### Backups and upgrades

Before upgrading, back up the database and securely preserve `.env`, especially
`ENCRYPTION_KEY`. Losing the encryption key prevents decryption of stored data.
Use encrypted backup storage; database dumps contain financial information.

For the default database user and name:

```bash
mkdir -p backups
docker compose --env-file .env -f docker/docker-compose.yml exec -T db \
  pg_dump -U finance_app -d finance > "backups/finance-$(date +%Y%m%d-%H%M%S).sql"
```

Test restoring backups into a separate database. For an upgrade, review the
changes, take a backup, stop the app, rebuild the image, run migrations, then
start the app and check `/api/health`. Do not delete the database volume during
an upgrade.

## Privacy and security

- Plaid access tokens and selected account and recurring-item fields use
  AES-256-GCM encryption. The entire database is not encrypted by the app.
- Agent query views omit sensitive token fields. They reduce accidental
  exposure; the app still uses a shared database connection and role.
- Chat, planner, report, and budget-goal prompts mask supported account,
  institution, and merchant names. This is not complete anonymization: amounts,
  dates, categories, and other financial context can reach the configured AI
  provider. Weekly digests also send financial summaries to that provider.
- Local inference changes the AI endpoint. Plaid sync and planner web search
  still use external services; the application is not fully offline.
- Sessions use encrypted, HTTP-only cookies. Login and API limits are held in
  process memory and are not shared across replicas or preserved on restart.
- Plaid webhook verification checks signatures and body hashes. The audit log
  records selected authentication, institution, and report events; it is not
  an immutable record of every operation.

Keep database and model endpoints private, preserve secrets outside version
control, and use HTTPS for deployed instances. Do not use demo mode with real
financial data or expose its password-bypassing login publicly.

## Development and testing

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
npm audit --omit=dev --audit-level=high
```

Integration tests require a migrated, disposable PostgreSQL database ending
in `_test`; they truncate fixtures. Browser tests also require that database
and Chromium. Follow [the testing guide](docs/TESTING.md) to enable both tiers.
Without `TEST_DATABASE_URL`, database integration suites skip. Live-model smoke
tests are opt-in; default tests use deterministic model fixtures.

GitHub Actions runs on pull requests and pushes to `dev`, `stable`, and `main`,
and by manual dispatch. It checks lint, types, coverage with database integration,
browser smoke flows, a production dependency audit, the Next.js build, both
Compose layouts, and a Docker image build. Test evidence is retained for 14 days.
The separate tag-triggered release workflow is defined in
[release.yml](.github/workflows/release.yml); a passing development build does
not establish that a release has been published.

## Architecture

| Layer | Implementation |
| --- | --- |
| Web application | Next.js 16 App Router, React 19, TypeScript in strict mode. |
| UI | Tailwind CSS 4, Radix UI, Recharts, and SWR. |
| Persistence | PostgreSQL 16, Drizzle ORM, SQL migrations, and query views. |
| AI | Vercel AI SDK 6 with Gemini or OpenAI-compatible Chat Completions. |
| Authentication | iron-session and bcrypt password verification. |
| Financial data | Plaid Link, cursor-based transaction sync, balance snapshots, and webhooks. |
| Reporting | PDFKit with in-memory charts and PDF rendering. |
| Hosting | Node.js or Docker Compose, with an external or optional bundled TLS proxy. |

Routes live in `app/`, UI components in `components/`, and server modules in
`lib/`. Ticker and Budget Planner stream tool-assisted responses; the planner's
three modes share a tool set that includes DuckDuckGo search. Tables are defined
in [schema.ts](lib/db/schema.ts) and agent query views in
[views.ts](lib/db/views.ts). Fresh-install bootstrap and upgrades are handled
by [scripts/migrate.mjs](scripts/migrate.mjs).

The in-process scheduler starts through `instrumentation.ts`: daily Plaid sync
at 06:00 and a weekly digest on Mondays at 08:00, in the server's local timezone.
Settings toggles take effect on the next scheduled tick. Jobs require a running
process and are disabled in demo mode. Multiple app replicas each start a
scheduler, so deployments need to coordinate scheduling before scaling out.

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md) for development conventions and pull
request requirements. The project is licensed under [ISC](LICENSE).

Powerhour uses system font stacks and ships no proprietary font binaries.
See [the font policy](docs/FONTS.md) before adding custom fonts.
