-- Agent-facing database views
-- SEC-02: Views are inherently read-only (no INSERT/UPDATE/DELETE possible)
-- SEC-03: Excludes plaid_access_token, sync_cursor, error_code from all results
--
-- Apply with: npm run db:migrate

CREATE OR REPLACE VIEW agent_accounts_view AS
SELECT
  a.id,
  a.name,
  a.official_name,
  a.type,
  a.subtype,
  a.currency_code,
  a.current_balance,
  a.available_balance,
  a.credit_limit,
  a.is_active,
  a.institution_id,
  i.institution_name,
  i.status AS institution_status,
  i.last_synced_at
FROM accounts a
INNER JOIN institutions i ON a.institution_id = i.id
WHERE a.is_active = true;

CREATE OR REPLACE VIEW agent_institutions_view AS
SELECT
  id,
  institution_name,
  status,
  last_synced_at
FROM institutions;
