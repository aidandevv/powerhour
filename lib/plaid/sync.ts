import { eq, and } from "drizzle-orm";
import { plaidClient } from "./client";
import { db } from "@/lib/db";
import {
  institutions,
  accounts,
  transactions,
  balanceSnapshots,
} from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";

export async function syncInstitution(institutionId: string) {
  const [institution] = await db
    .select()
    .from(institutions)
    .where(eq(institutions.id, institutionId));

  if (!institution) {
    throw new Error(`Institution ${institutionId} not found`);
  }

  const accessToken = decrypt(institution.plaidAccessToken);

  try {
    await syncTransactions(institution.id, accessToken, institution.syncCursor);
    await syncBalances(institution.id, accessToken);

    await db
      .update(institutions)
      .set({
        lastSyncedAt: new Date(),
        status: "active",
        errorCode: null,
        updatedAt: new Date(),
      })
      .where(eq(institutions.id, institutionId));
  } catch (error: unknown) {
    const plaidError = error as { response?: { data?: { error_code?: string } } };
    const errorCode = plaidError.response?.data?.error_code;

    const status = errorCode === "ITEM_LOGIN_REQUIRED" ? "relink_required" : "error";

    await db
      .update(institutions)
      .set({
        status,
        errorCode: errorCode || "UNKNOWN_ERROR",
        updatedAt: new Date(),
      })
      .where(eq(institutions.id, institutionId));

    throw error;
  }
}

async function syncTransactions(
  institutionId: string,
  accessToken: string,
  cursor: string | null
) {
  let hasMore = true;
  let currentCursor = cursor || undefined;

  // Get accounts for this institution to map plaid account IDs
  const institutionAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.institutionId, institutionId));

  const accountMap = new Map(
    institutionAccounts.map((a) => [a.plaidAccountId, a.id])
  );

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor: currentCursor,
    });

    const { added, modified, removed, has_more, next_cursor } = response.data;

    // Process added transactions
    for (const txn of added) {
      const accountId = accountMap.get(txn.account_id);
      if (!accountId) continue;

      await db
        .insert(transactions)
        .values({
          accountId,
          plaidTransactionId: txn.transaction_id,
          amount: txn.amount.toString(),
          currencyCode: txn.iso_currency_code || "USD",
          date: txn.date,
          name: txn.name,
          merchantName: txn.merchant_name || null,
          category: txn.personal_finance_category?.primary || null,
          categoryDetailed: txn.personal_finance_category?.detailed || null,
          pending: txn.pending,
          paymentChannel: txn.payment_channel || null,
          logoUrl: txn.logo_url || null,
          website: txn.website || null,
        })
        .onConflictDoUpdate({
          target: transactions.plaidTransactionId,
          set: {
            amount: txn.amount.toString(),
            date: txn.date,
            name: txn.name,
            merchantName: txn.merchant_name || null,
            category: txn.personal_finance_category?.primary || null,
            categoryDetailed: txn.personal_finance_category?.detailed || null,
            pending: txn.pending,
            paymentChannel: txn.payment_channel || null,
            logoUrl: txn.logo_url || null,
            website: txn.website || null,
            updatedAt: new Date(),
          },
        });
    }

    // Process modified transactions
    for (const txn of modified) {
      await db
        .update(transactions)
        .set({
          amount: txn.amount.toString(),
          date: txn.date,
          name: txn.name,
          merchantName: txn.merchant_name || null,
          category: txn.personal_finance_category?.primary || null,
          categoryDetailed: txn.personal_finance_category?.detailed || null,
          pending: txn.pending,
          paymentChannel: txn.payment_channel || null,
          logoUrl: txn.logo_url || null,
          website: txn.website || null,
          updatedAt: new Date(),
        })
        .where(eq(transactions.plaidTransactionId, txn.transaction_id));
    }

    // Process removed transactions
    for (const txn of removed) {
      if (txn.transaction_id) {
        await db
          .delete(transactions)
          .where(eq(transactions.plaidTransactionId, txn.transaction_id));
      }
    }

    currentCursor = next_cursor;
    hasMore = has_more;
  }

  // Update sync cursor
  if (currentCursor) {
    await db
      .update(institutions)
      .set({ syncCursor: currentCursor, updatedAt: new Date() })
      .where(eq(institutions.id, institutionId));
  }
}

async function syncBalances(institutionId: string, accessToken: string) {
  const response = await plaidClient.accountsGet({
    access_token: accessToken,
  });

  const today = new Date().toISOString().split("T")[0];

  for (const acct of response.data.accounts) {
    // Update current account balances
    await db
      .update(accounts)
      .set({
        currentBalance: acct.balances.current?.toString() || null,
        availableBalance: acct.balances.available?.toString() || null,
        creditLimit: acct.balances.limit?.toString() || null,
        updatedAt: new Date(),
      })
      .where(eq(accounts.plaidAccountId, acct.account_id));

    // Get the account ID from our DB
    const [dbAccount] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.plaidAccountId, acct.account_id));

    if (!dbAccount) continue;

    // Take daily balance snapshot
    await db
      .insert(balanceSnapshots)
      .values({
        accountId: dbAccount.id,
        snapshotDate: today,
        currentBalance: acct.balances.current?.toString() || null,
        availableBalance: acct.balances.available?.toString() || null,
      })
      .onConflictDoUpdate({
        target: [balanceSnapshots.accountId, balanceSnapshots.snapshotDate],
        set: {
          currentBalance: acct.balances.current?.toString() || null,
          availableBalance: acct.balances.available?.toString() || null,
        },
      });
  }
}

export async function syncAllInstitutions() {
  const allInstitutions = await db
    .select({ id: institutions.id })
    .from(institutions)
    .where(eq(institutions.status, "active"));

  const results: { id: string; success: boolean; error?: string }[] = [];

  for (const inst of allInstitutions) {
    try {
      await syncInstitution(inst.id);
      results.push({ id: inst.id, success: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      results.push({ id: inst.id, success: false, error: message });
    }
  }

  return results;
}
