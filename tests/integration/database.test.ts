import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

function isDedicatedTestDatabase(url: string | undefined): boolean {
  if (!url) return false;

  try {
    const databaseName = new URL(url).pathname.replace(/^\//, "");
    return databaseName.endsWith("_test");
  } catch {
    return false;
  }
}

if (testDatabaseUrl && !isDedicatedTestDatabase(testDatabaseUrl)) {
  throw new Error("TEST_DATABASE_URL must use a database name ending in _test.");
}

const describeDatabase = isDedicatedTestDatabase(testDatabaseUrl) ? describe : describe.skip;

describeDatabase("PostgreSQL integration", () => {
  let sql: Sql;

  beforeAll(async () => {
    sql = postgres(testDatabaseUrl!, { max: 1, ssl: false });
  });

  beforeEach(async () => {
    await sql.unsafe("TRUNCATE TABLE institutions CASCADE");
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("has a migrated schema before application integration tests run", async () => {
    const [result] = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM powerhour_migrations
    `;

    expect(Number(result.count)).toBeGreaterThan(0);
  });

  it("keeps encrypted Plaid tokens outside the agent-facing account view", async () => {
    const [institution] = await sql<{ id: string }[]>`
      INSERT INTO institutions (
        plaid_item_id,
        plaid_access_token,
        institution_name,
        institution_id
      ) VALUES (
        'item-integration-1',
        'encrypted-private-token',
        'Integration Bank',
        'ins-integration-1'
      )
      RETURNING id
    `;
    const [account] = await sql<{ id: string }[]>`
      INSERT INTO accounts (
        institution_id,
        plaid_account_id,
        name,
        type,
        current_balance,
        available_balance
      ) VALUES (
        ${institution.id},
        'account-integration-1',
        'Operating account',
        'depository',
        '1000.00',
        '900.00'
      )
      RETURNING id
    `;

    const [viewRow] = await sql<Record<string, unknown>[]>`
      SELECT * FROM agent_accounts_view WHERE id = ${account.id}
    `;

    expect(viewRow).toMatchObject({
      id: account.id,
      name: "Operating account",
      institution_name: "Integration Bank",
    });
    expect(viewRow).not.toHaveProperty("plaid_access_token");
    expect(viewRow).not.toHaveProperty("sync_cursor");
  });

  it("enforces the Plaid transaction uniqueness invariant", async () => {
    const [institution] = await sql<{ id: string }[]>`
      INSERT INTO institutions (
        plaid_item_id,
        plaid_access_token,
        institution_name,
        institution_id
      ) VALUES (
        'item-integration-2',
        'encrypted-private-token',
        'Integration Bank',
        'ins-integration-2'
      )
      RETURNING id
    `;
    const [account] = await sql<{ id: string }[]>`
      INSERT INTO accounts (institution_id, plaid_account_id, name, type)
      VALUES (${institution.id}, 'account-integration-2', 'Checking', 'depository')
      RETURNING id
    `;

    await sql`
      INSERT INTO transactions (account_id, plaid_transaction_id, amount, date, name)
      VALUES (${account.id}, 'transaction-integration-1', '12.34', '2026-01-15', 'Coffee')
    `;

    await expect(
      sql`
        INSERT INTO transactions (account_id, plaid_transaction_id, amount, date, name)
        VALUES (${account.id}, 'transaction-integration-1', '12.34', '2026-01-15', 'Coffee')
      `
    ).rejects.toThrow();
  });
});
