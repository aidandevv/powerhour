import { CountryCode, Products } from "plaid";
import { eq } from "drizzle-orm";
import { plaidClient } from "./client";
import { db } from "@/lib/db";
import { institutions, accounts } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { encryptField } from "@/lib/crypto-fields";

export async function createLinkToken() {
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: "single-user" },
    client_name: "powerhour",
    products: [
      Products.Transactions,
      Products.Investments,
      Products.Liabilities,
    ],
    country_codes: [CountryCode.Us],
    language: "en",
    webhook: process.env.PLAID_WEBHOOK_URL || undefined,
  });

  return response.data.link_token;
}

export async function createRelinkToken(accessToken: string) {
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: "single-user" },
    client_name: "powerhour",
    country_codes: [CountryCode.Us],
    language: "en",
    access_token: accessToken,
    webhook: process.env.PLAID_WEBHOOK_URL || undefined,
  });

  return response.data.link_token;
}

export async function exchangePublicToken(publicToken: string) {
  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });

  const { access_token, item_id } = response.data;

  // Get institution info
  const itemResponse = await plaidClient.itemGet({ access_token });
  const instId = itemResponse.data.item.institution_id;

  let institutionName = "Unknown Institution";
  if (instId) {
    try {
      const instResponse = await plaidClient.institutionsGetById({
        institution_id: instId,
        country_codes: [CountryCode.Us],
      });
      institutionName = instResponse.data.institution.name;
    } catch {
      // Fall back to unknown
    }
  }

  // Store institution with encrypted access token
  const encryptedToken = encrypt(access_token);

  const [institution] = await db
    .insert(institutions)
    .values({
      plaidItemId: item_id,
      plaidAccessToken: encryptedToken,
      institutionName,
      institutionId: instId || "unknown",
      status: "active",
    })
    .returning();

  // Fetch and store accounts
  const accountsResponse = await plaidClient.accountsGet({ access_token });

  for (const acct of accountsResponse.data.accounts) {
    await db.insert(accounts).values({
      institutionId: institution.id,
      plaidAccountId: acct.account_id,
      name: encryptField(acct.name) ?? acct.name,
      officialName: encryptField(acct.official_name || null),
      type: acct.type,
      subtype: acct.subtype || null,
      currencyCode: acct.balances.iso_currency_code || "USD",
      currentBalance: acct.balances.current?.toString() || null,
      availableBalance: acct.balances.available?.toString() || null,
      creditLimit: acct.balances.limit?.toString() || null,
    });
  }

  return institution;
}

/** Update an existing institution with a new access token (after relink) */
export async function updateInstitutionAccessToken(
  institutionId: string,
  publicToken: string
) {
  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });

  const { access_token } = response.data;
  const encryptedToken = encrypt(access_token);

  const [updated] = await db
    .update(institutions)
    .set({
      plaidAccessToken: encryptedToken,
      status: "active",
      errorCode: null,
      updatedAt: new Date(),
    })
    .where(eq(institutions.id, institutionId))
    .returning();

  if (!updated) throw new Error("Institution not found");
  return updated;
}
