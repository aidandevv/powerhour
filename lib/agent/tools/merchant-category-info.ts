/**
 * Merchant category breakdown — for "why is X categorized as Y?" and rule suggestions.
 * Returns category distribution for a merchant so the agent can explain and suggest recategorization.
 */
import { db } from "@/lib/db";
import { transactions, accounts } from "@/lib/db/schema";
import { or, ilike, eq } from "drizzle-orm";

export interface MerchantCategoryRow {
  category: string;
  count: number;
  totalAmount: number;
}

export interface MerchantCategoryResult {
  merchant: string;
  totalTransactions: number;
  totalSpent: number;
  byCategory: MerchantCategoryRow[];
  mostCommonCategory: string | null;
  suggestion: string;
}

export async function getMerchantCategoryInfo(
  merchantQuery: string
): Promise<MerchantCategoryResult> {
  const pattern = `%${merchantQuery}%`;

  const rows = await db
    .select({
      category: transactions.category,
      amount: transactions.amount,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      or(
        ilike(transactions.merchantName, pattern),
        ilike(transactions.name, pattern)
      )!
    );

  const categoryMap = new Map<string, { count: number; totalAmount: number }>();

  for (const row of rows) {
    const cat = row.category ?? "Uncategorized";
    const amount = parseFloat(String(row.amount));
    const existing = categoryMap.get(cat) ?? { count: 0, totalAmount: 0 };
    categoryMap.set(cat, {
      count: existing.count + 1,
      totalAmount: existing.totalAmount + amount,
    });
  }

  const byCategory: MerchantCategoryRow[] = Array.from(categoryMap.entries())
    .map(([category, { count, totalAmount }]) => ({ category, count, totalAmount }))
    .sort((a, b) => b.count - a.count);

  const mostCommonCategory =
    byCategory.length > 0 ? byCategory[0].category : null;
  const totalTransactions = rows.length;
  const totalSpent = rows
    .filter((r) => parseFloat(String(r.amount)) > 0)
    .reduce((sum, r) => sum + parseFloat(String(r.amount)), 0);

  // Build suggestion: if mostly one category, no suggestion; if mixed or wrong category, suggest
  const FOOD_CATEGORIES = [
    "FOOD_AND_DRINK",
    "RESTAURANTS",
    "FOOD_AND_DRINK_RESTAURANTS",
  ];
  const isFoodMerchant =
    /door|dash|uber|eats|grubhub|restaurant|cafe|coffee|pizza|delivery|food/i.test(
      merchantQuery
    );
  const isInFoodCategory =
    mostCommonCategory && FOOD_CATEGORIES.includes(mostCommonCategory);
  const hasMultipleCategories = byCategory.length > 1;

  let suggestion = "";
  if (totalTransactions === 0) {
    suggestion = "No transactions found for this merchant.";
  } else if (hasMultipleCategories) {
    suggestion = `This merchant appears under ${byCategory.length} categories. Consider standardizing to the most common (${mostCommonCategory}) for clearer reporting.`;
  } else if (isFoodMerchant && mostCommonCategory && !isInFoodCategory) {
    suggestion = `This appears to be a food/dining merchant but is categorized as "${mostCommonCategory}". Consider recategorizing to FOOD_AND_DRINK for accurate dining spend tracking.`;
  } else if (mostCommonCategory) {
    suggestion = `Consistently categorized as "${mostCommonCategory}".`;
  }

  return {
    merchant: merchantQuery,
    totalTransactions,
    totalSpent,
    byCategory,
    mostCommonCategory,
    suggestion,
  };
}
