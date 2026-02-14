# Personal Finance Dashboard

A self-hosted, single-user personal finance dashboard that aggregates spending, balances, and investment data across all financial institutions via the Plaid API.

**This project is not affiliated with Plaid. Each deployer is responsible for their own Plaid API credentials and must comply with Plaid's terms of service.**

## Features

- Unified view of all accounts: checking, savings, credit cards, investments, and loans
- Real-time balance tracking and net worth over time
- Transaction search with category filtering
- Automated recurring expense detection and 30/60/90-day projections
- Daily balance snapshots for historical charting
- Plaid webhook support for real-time transaction updates
- Single-user authentication with rate limiting
- AES-256-GCM encryption for all sensitive data at rest

## Prerequisites

- **Node.js 22+**
- **Docker** and **Docker Compose**
- **A Plaid developer account** — sign up at [dashboard.plaid.com](https://dashboard.plaid.com)

## Plaid Setup

1. Create a Plaid developer account at [dashboard.plaid.com](https://dashboard.plaid.com)
2. Navigate to **Developers > Keys** and copy your `client_id` and `secret`
3. Under **Developers > API**, configure your allowed redirect URIs to include your domain
4. For development, use the `development` environment. For production with real bank data, apply for production access

## Local Development Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo-url>
   cd financial-project
   npm install
   ```

2. **Create your environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Generate required secrets:**
   ```bash
   # Encryption key (32 bytes, hex-encoded)
   openssl rand -hex 32

   # Session secret (64 bytes, hex-encoded)
   openssl rand -hex 64

   # Password hash (replace YOUR_PASSWORD)
   node -e "const b=require('bcryptjs');b.hash('YOUR_PASSWORD',12).then(h=>console.log(h))"
   ```

4. **Fill in `.env`** with your Plaid credentials, database URL, and generated secrets.

5. **Start PostgreSQL with Docker:**
   ```bash
   docker compose -f docker/docker-compose.yml up db -d
   ```

6. **Push the database schema:**
   ```bash
   npm run db:push
   ```

7. **Start the development server:**
   ```bash
   npm run dev
   ```

8. Open [http://localhost:3000](http://localhost:3000) and log in with your password.

## Production Deployment (Hetzner VPS)

### 1. Provision a VPS

- Create a Hetzner CAX11 (2 vCPU ARM, 4GB RAM) or equivalent
- Install Docker and Docker Compose
- Point your domain's DNS A record to the VPS IP

### 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### 3. Set up TLS with Let's Encrypt

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d finance.yourdomain.com
```

Update the `nginx.conf` SSL certificate paths to match your domain:
```
ssl_certificate /etc/letsencrypt/live/finance.yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/finance.yourdomain.com/privkey.pem;
```

Set up auto-renewal:
```bash
echo "0 3 * * * certbot renew --quiet --deploy-hook 'docker compose -f /path/to/docker/docker-compose.yml restart nginx'" | sudo crontab -
```

### 4. Deploy

```bash
# Clone to your server
git clone <your-repo-url> /opt/finance-dashboard
cd /opt/finance-dashboard

# Create and fill .env
cp .env.example .env
nano .env  # Fill in all values

# Build and start
docker compose -f docker/docker-compose.yml up -d --build

# Push database schema
docker compose -f docker/docker-compose.yml exec app npx drizzle-kit push
```

### 5. DNS Configuration

Set an A record for your domain pointing to your VPS IP address. The nginx config handles HTTP-to-HTTPS redirect and all security headers.

## Database Backup

Automated daily backup using `pg_dump` with GPG encryption:

```bash
#!/bin/bash
# backup.sh — run via cron: 0 2 * * * /opt/finance-dashboard/backup.sh

BACKUP_DIR="/opt/finance-dashboard/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# Dump database
docker compose -f /opt/finance-dashboard/docker/docker-compose.yml exec -T db \
  pg_dump -U finance_app finance | \
  gpg --symmetric --batch --passphrase-file /opt/finance-dashboard/.backup-passphrase \
  > "$BACKUP_DIR/finance_$TIMESTAMP.sql.gpg"

# Keep only last 30 days
find "$BACKUP_DIR" -name "*.sql.gpg" -mtime +30 -delete
```

To restore from backup:
```bash
gpg --decrypt backup_file.sql.gpg | docker compose exec -T db psql -U finance_app finance
```

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Recharts
- **Backend:** Next.js API Routes, Drizzle ORM, PostgreSQL
- **Auth:** iron-session, bcrypt, rate-limiter-flexible
- **Data:** Plaid API (Transactions, Balance, Investments, Liabilities)
- **Deployment:** Docker Compose, nginx, Let's Encrypt

## License

ISC
# powerhour-testing
