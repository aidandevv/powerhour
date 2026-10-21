# powerhour

A self-hosted personal finance dashboard with AI-powered insights, built with Next.js, Plaid, and Gemini.

Aggregates spending, balances, and recurring expenses across all your financial institutions into a single dashboard — then layers on two AI agents that can answer questions about your money, generate PDF reports, plan travel budgets, and help you cut spending.

> **Not affiliated with Plaid.** Each deployer is responsible for their own Plaid API credentials and must comply with Plaid's terms of service.

---

## What it does

**Dashboard** — Net worth tracking, spending trends by category, credit utilization, account balances, and KPI cards. All charts update daily via automated Plaid sync.

**Ticker AI chat** — A conversational agent embedded in the dashboard. Ask things like *"How much did I spend on dining last month?"*, *"Audit my subscriptions"*, or *"Generate a report for January"*. Ticker calls 24 tools to query your real transaction data and streams answers back in real time.

**Budget Planner** — A separate AI agent with three modes:
- **Travel budgets** — Researches real costs via Google search grounding, then builds a detailed budget table with low/mid/high estimates
- **Savings goals** — *"Have $5k saved by May"* → calculates monthly savings needed, checks feasibility against your recurring expenses, and tracks progress on the dashboard
- **Cut spending** — Analyses your top spending categories and suggests actionable budget caps based on your actual data

**PDF reports** — On-demand financial reports generated entirely in-memory with custom PDFKit charts. Nine sections including an AI-written narrative summary, spending breakdowns, net worth history, and anomaly highlights.

**Subscriptions audit** — Flags recurring charges with no activity in 90+ days and calculates potential monthly savings if cancelled.

**Smart Budget Goals** — AI-generated spending caps per category with progress tracking. Based on 3-month spending history and month-over-month trends.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, Server Components) |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL 16 via Drizzle ORM |
| AI | Gemini 2.5 Flash Lite via Vercel AI SDK v6 (local OpenAI-compatible models optional) |
| Auth | iron-session (encrypted httpOnly cookies, 8-hour expiry) |
| Financial data | Plaid API (transactions, balances, recurring detection, webhooks) |
| Styling | Tailwind CSS + shadcn/ui |
| PDF | PDFKit (in-memory rendering, custom chart primitives) |
| Deployment | Docker Compose, nginx reverse proxy, Let's Encrypt TLS |

---

## Pages

| Route | Description |
|---|---|
| `/` | Dashboard — net worth, KPI cards, budget goals, savings targets, account overview, embedded Ticker chat |
| `/transactions` | Searchable transaction list with filters, pagination, and expense group management |
| `/accounts` | Institution-grouped accounts with per-account balance history charts |
| `/projections` | Expense calendar, recurring item management, and savings goal projection charts |
| `/subscriptions` | Subscription audit — flags inactive items, shows cost at risk |
| `/budgets` | AI-generated smart budget goals with per-category progress bars |
| `/budget-planner` | Two-pane AI chat for travel budgets, savings goals, and spending analysis |
| `/settings` | Theme, scheduled job toggles, password management, Plaid institutions, security log |

---

## Security

- **Encryption at rest** — Plaid access tokens encrypted with AES-256-GCM (random IV per encryption, separate auth tag)
- **Database-layer isolation** — AI agent tools query PostgreSQL views that structurally exclude sensitive columns. Even a compromised prompt cannot access tokens.
- **Layered rate limiting** — nginx (login), application middleware (all API routes), per-endpoint limits (chat, report, budget planner), and a global login-failure ceiling; client addresses come from `X-Forwarded-For` only when `TRUSTED_PROXY_HOPS` is configured
- **Webhook verification** — Full JWK-based JWT signature + SHA-256 body hash verification for Plaid webhooks
- **Audit log** — Records logins, password changes, institution links/deletes, and report downloads with IP and metadata
- **HTTP headers** — HSTS, CSP with Plaid allowlist, X-Frame-Options DENY, strict referrer policy

---

## Quick start

### Prerequisites

- Node.js 22+
- Docker Engine with Docker Compose v2 (`docker compose`)
- A [Plaid developer account](https://dashboard.plaid.com) for real bank syncs
- A [Google AI Studio API key](https://aistudio.google.com/app/apikey) for AI chat, reports, and budget planning, or a local OpenAI-compatible model server (see [Local models](#local-models-beta))

Plaid and Gemini are optional for demo mode. Demo mode seeds fake data and is the fastest way to verify the app before connecting real accounts.

### Setup

```bash
git clone https://github.com/<owner>/powerhour.git
cd powerhour
npm install

# Generate secrets and configure environment
npm run setup

# Fill in Plaid credentials, database URL, and Gemini API key
nano .env

# Start PostgreSQL
docker compose -f docker/docker-compose.yml up db -d

# Push database schema
npm run db:push

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your password.

### Demo mode

To run without Plaid credentials, set `DEMO_MODE=true` and `NEXT_PUBLIC_DEMO_MODE=true` in `.env`. The app seeds realistic fake data on startup — two institutions, four accounts, 6 months of transactions, recurring items, budget goals, and savings targets.

### Local models (Beta)

AI features use Gemini by default. Set `AI_PROVIDER=openai-compatible` to use a local model server that speaks the OpenAI Chat Completions API instead: [Ollama](https://ollama.com), the llama.cpp server, or LM Studio. All five local-model features are **Beta**: Ticker, Budget Planner, PDF report summaries, smart budget goals, and weekly AI digests. Their frontend entry points display beta badges; Settings → AI models shows each configured model. `GEMINI_API_KEY` is then not needed. PII masking for the chat and budget planner agents stays on for every provider.

```bash
AI_PROVIDER=openai-compatible
AI_BASE_URL=http://localhost:11434/v1   # Ollama
AI_MODEL=qwen3:8b                       # any tool-calling model the server has loaded
# Optional: a different model per feature
# AI_MODEL_CHAT=  AI_MODEL_PLANNER=  AI_MODEL_DIGEST=  AI_MODEL_REPORT=  AI_MODEL_GOALS=
# Optional overrides (these are the local-model Beta defaults)
AI_CHAT_TIMEOUT_MS=300000
AI_PLANNER_TIMEOUT_MS=600000
AI_DIGEST_TIMEOUT_MS=180000
AI_REPORT_TIMEOUT_MS=180000
AI_GOALS_TIMEOUT_MS=180000
```

| Variable | Default | Purpose |
|---|---|---|
| `AI_PROVIDER` | `google` | `google` or `openai-compatible` |
| `AI_MODEL` | `gemini-2.5-flash-lite` (google) | Model id; required for `openai-compatible` |
| `AI_MODEL_<FEATURE>` | `AI_MODEL` | Per-feature override: `CHAT`, `PLANNER`, `DIGEST`, `REPORT`, `GOALS` |
| `AI_BASE_URL` | — | Endpoint ending in `/v1`; required for `openai-compatible` |
| `AI_API_KEY` | — | Optional bearer token for the endpoint |
| `AI_STRUCTURED_OUTPUTS` | `true` | Set `false` if the server rejects `json_schema` response formats |
| `AI_CHAT_MAX_STEPS` / `AI_CHAT_TIMEOUT_MS` | `8` / `90000` | Ticker agent limits |
| `AI_PLANNER_MAX_STEPS` / `AI_PLANNER_TIMEOUT_MS` | `16` / `120000` | Budget planner limits |
| `AI_DIGEST_TIMEOUT_MS` / `AI_REPORT_TIMEOUT_MS` / `AI_GOALS_TIMEOUT_MS` | `30000` / `15000` / `30000` | Single-call timeouts |

The limit table shows hosted defaults. Local-model Beta defaults allow 300 seconds for Ticker, 600 seconds for Budget Planner, and 180 seconds for each single-call feature. Explicit timeout variables override either provider's defaults.

**Context window.** The agent system prompts and 24 tool schemas need far more than Ollama's default context window, and Ollama silently truncates prompts that overflow it. The OpenAI-compatible endpoint cannot set `num_ctx` per request, so set it on the server: start Ollama with `OLLAMA_CONTEXT_LENGTH=16384 ollama serve`, or create a model variant with `PARAMETER num_ctx 16384` in a Modelfile.

**Docker on macOS.** Run Ollama natively on the host, not in a container: Docker on macOS has no access to the Metal GPU, so a containerized model runs on the CPU only. Point the app container at the host with `AI_BASE_URL=http://host.docker.internal:11434/v1`. Both Compose files map `host.docker.internal` to the host gateway, so the same URL also works on Linux. On Linux, Ollama must listen on an address the container can reach (for example `OLLAMA_HOST=0.0.0.0`; firewall it from the network).

**Quality.** Local-model compatibility and tool selection vary by model. All five integrations are Beta. Smoke checks establish that the features run; they do not establish answer quality or financial accuracy. Review generated outputs before using them.

---

## Production deployment

### Release Docker Compose (recommended)

This is the easiest production path: download the release Compose file, generate a host `.env`, run migrations, then start the app. It does not require Node.js or a source checkout on the server.

```bash
# On your server
mkdir -p /opt/powerhour
cd /opt/powerhour

# Pick the version you want to deploy
export POWERHOUR_VERSION=v1.0.0
export POWERHOUR_IMAGE="ghcr.io/<owner>/powerhour:${POWERHOUR_VERSION}"

curl -fsSLO "https://github.com/<owner>/powerhour/releases/download/${POWERHOUR_VERSION}/docker-compose.yml"
curl -fsSLo .env.example "https://github.com/<owner>/powerhour/releases/download/${POWERHOUR_VERSION}/env.example"
curl -fsSLO "https://github.com/<owner>/powerhour/releases/download/${POWERHOUR_VERSION}/checksums.sha256"
sha256sum -c checksums.sha256

# Generate .env interactively
docker run --rm -it \
  -v "$PWD:/workspace" \
  "${POWERHOUR_IMAGE}" \
  node scripts/setup.cjs \
    --env /workspace/.env \
    --template /workspace/.env.example \
    --version "${POWERHOUR_VERSION}"

# Initialize or upgrade the database, then start the app
docker compose --profile tools run --rm migrate
docker compose up -d
```

The setup wizard asks for production or demo mode, generates secrets, writes `.env`, and prints the exact migration/start commands. When run through the release image, the wizard usually cannot run Docker Compose itself because the Docker CLI/socket is not mounted into that container; run the printed commands from your host shell.

For a quick demo install, choose `demo` in the wizard. It enables seeded fake data and skips Plaid credential prompts. AI chat, reports, budget goals, digests, and budget planner still need a Gemini key; the wizard lets you add one during demo setup or later in `.env`.

The release Compose file uses `POWERHOUR_IMAGE` and binds the app to `127.0.0.1:3000` by default. Put Caddy, nginx, Traefik, Cloudflare Tunnel, or another TLS reverse proxy in front of it for internet access. Set `POWERHOUR_HOST=0.0.0.0` only if you intentionally want Docker to bind directly on every network interface.

When a reverse proxy sits in front of the app, set `TRUSTED_PROXY_HOPS` in `.env` to the number of proxies that set or append to `X-Forwarded-For` (usually `1`). The default `0` ignores forwarding headers entirely, because a client talking to the app directly can forge them; every client then shares one rate-limit bucket. Never set it higher than the real proxy count, or clients can choose their own rate-limit key.

Useful release commands:

```bash
docker compose ps
docker compose logs -f app
curl -fsS http://127.0.0.1:3000/api/health
```

If you prefer manual setup, copy `.env.example` to `.env`, fill in the required values, then run the same migration and start commands above. Wrap `DASHBOARD_PASSWORD_HASH` in single quotes because bcrypt hashes contain `$` characters that Docker Compose otherwise treats as interpolation syntax.

For source builds from a cloned repository, use:

```bash
git clone https://github.com/<owner>/powerhour.git /opt/powerhour
cd /opt/powerhour
cp .env.example .env && nano .env
docker compose -f docker/docker-compose.yml up -d --build
docker compose -f docker/docker-compose.yml exec app node scripts/migrate.mjs
```

The source Compose file exposes the app on `127.0.0.1:3000` by default. Its bundled nginx service is opt-in for hosts where you want this repo to manage TLS directly.

### TLS

The release Compose file intentionally leaves TLS to your reverse proxy. If you build from source and want to use the bundled nginx config, issue certificates first, then start Compose with the `tls` profile:

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d finance.yourdomain.com
docker compose -f docker/docker-compose.yml --profile tls up -d --build
```

Update `docker/nginx/nginx.conf` with your certificate paths and server name, and set `TRUSTED_PROXY_HOPS=1` in `.env`. Auto-renewal:

```bash
echo "0 3 * * * certbot renew --quiet --deploy-hook 'docker compose -f /opt/powerhour/docker/docker-compose.yml --profile tls restart nginx'" | sudo crontab -
```

### Database backups

```bash
# Daily encrypted backup via cron
cd /opt/powerhour
docker compose exec -T db \
  pg_dump -U finance_app finance | \
  gpg --symmetric --batch --passphrase-file /opt/powerhour/.backup-passphrase \
  > /opt/powerhour/backups/finance_$(date +%Y%m%d).sql.gpg

# Restore
gpg --decrypt backup_file.sql.gpg | docker compose exec -T db psql -U finance_app finance
```

For source deployments, add `-f docker/docker-compose.yml` to the backup and restore `docker compose` commands.

---

## Architecture

### AI agents

**Ticker** (`lib/agent/agent.ts`) — ReAct agent with 24 tools, 8-step iteration cap, 90-second timeout (both configurable). Tools query spending summaries, account balances, transactions, recurring expenses, cash flow forecasts, anomalies, debt payoff timelines, and more. Streams responses via SSE.

**Budget Planner** (`lib/agent/budget-planner-agent.ts`) — 16-step cap, 120-second timeout (both configurable). Supports web search via Google Grounding. Three intent-detected modes with distinct tool sets and conversation flows.

### Plaid integration

- **Link flow** — Plaid Link widget → link token → access token exchange (encrypted immediately)
- **Sync** — Cursor-based pagination via Plaid Transactions Sync API with transaction upserts and balance snapshots
- **Webhooks** — Signature-verified handlers for sync updates and item error events
- **Recurring detection** — Frequency analysis (weekly/biweekly/monthly/annually) populates the recurring items table

### Scheduler

In-process cron started via Next.js `instrumentation.ts`. Daily Plaid sync at 06:00, weekly AI digest on Mondays at 08:00. Both jobs respect database toggles — changes in Settings take effect on the next tick without a restart.

---

## Database

16 tables and 2 security views. Key tables:

| Table | Purpose |
|---|---|
| `institutions` | Plaid-linked banks with encrypted access tokens and sync state |
| `accounts` | Individual accounts with balances and credit limits |
| `transactions` | All transactions with category, merchant, payment channel |
| `balance_snapshots` | Daily per-account snapshots for historical charts |
| `recurring_items` | Detected recurring expenses with frequency and projected dates |
| `budget_plans` | Budget planner sessions with full message history (JSONB) |
| `savings_targets` | Goals with target amount, date, and monthly savings rate |
| `budget_goals` | AI-generated spending caps per category |
| `audit_log` | Immutable event log with IP and metadata |

Migrations are generated with Drizzle Kit. Use `npm run db:push` for development, and `node scripts/migrate.mjs` or the release Compose `migrate` service for production deployments.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## CI/CD

Pull requests and pushes to `main` run linting, TypeScript checks, full-source
coverage reporting, a disposable PostgreSQL integration suite, deterministic
demo browser smoke tests, production dependency audit, Next.js build, Docker
image build, and Docker Compose validation in GitHub Actions. CI retains
coverage reports and failed browser-test evidence for 14 days.

See [docs/TESTING.md](./docs/TESTING.md) for the test tiers, local setup, and
database safety guard.

Tags that match `v*.*.*` run the release preflight, publish
the configured container image, generate image provenance, and attach
`docker-compose.yml`, `env.example`, and checksums to the GitHub release.

## License

ISC

## Font policy

This repository uses system font stacks and does not ship proprietary font binaries. See [docs/FONTS.md](./docs/FONTS.md) before adding custom fonts to a public fork.
