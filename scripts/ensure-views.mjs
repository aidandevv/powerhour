#!/usr/bin/env node
/**
 * Ensures agent database views exist.
 * Run with: node scripts/ensure-views.mjs
 * Or add to package.json scripts.
 */
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  process.exit(1);
}

const client = postgres(DATABASE_URL);

try {
  console.log('🔍 Checking for agent views...');

  // Check if views exist
  const views = await client`
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name IN ('agent_accounts_view', 'agent_institutions_view')
  `;

  if (views.length === 2) {
    console.log('✅ All agent views already exist');
    await client.end();
    process.exit(0);
  }

  console.log('📝 Creating agent views...');

  // Read and execute the SQL file
  const sqlPath = join(__dirname, '..', 'lib', 'db', 'migrations', '0000_agent_views.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  // Split by statement and execute
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    await client.unsafe(statement);
  }

  console.log('✅ Agent views created successfully');

  // Verify
  const accounts = await client`SELECT COUNT(*) as count FROM agent_accounts_view`;
  console.log(`✅ Verified: ${accounts[0].count} accounts accessible via agent_accounts_view`);

} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
