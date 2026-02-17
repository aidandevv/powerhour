/**
 * Demo seed — inserts realistic fake financial data so the full app
 * (including AI agent, charts, budget goals) works without Plaid credentials.
 *
 * Idempotent: checks for the demo institution before inserting.
 * All IDs are fixed so re-runs are safe.
 */
import { db } from "@/lib/db";
import {
  institutions,
  accounts,
  transactions,
  balanceSnapshots,
  recurringItems,
  budgetGoals,
  savingsTargets,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  DEMO_INST_ID_1,
  DEMO_INST_ID_2,
  DEMO_ACCT_CHECKING,
  DEMO_ACCT_SAVINGS,
  DEMO_ACCT_VISA,
  DEMO_ACCT_MC,
} from "./index";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function d(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Returns array of {year, month} for the last N complete months, newest first */
function lastNMonths(n: number): Array<{ year: number; month: number }> {
  const result = [];
  const now = new Date();
  for (let i = 1; i <= n; i++) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ year: dt.getFullYear(), month: dt.getMonth() + 1 });
  }
  return result;
}

/** Returns ISO date string for today */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns ISO date for N days before today */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Next monthly date from a given date */
function nextMonth(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

// ─── Static entity definitions ────────────────────────────────────────────────

const DEMO_INSTITUTIONS = [
  {
    id: DEMO_INST_ID_1,
    plaidItemId: "demo-item-fnb",
    plaidAccessToken: "demo-access-token-fnb",
    institutionName: "First National Bank",
    institutionId: "ins_demo_001",
    status: "active" as const,
    lastSyncedAt: new Date(),
  },
  {
    id: DEMO_INST_ID_2,
    plaidItemId: "demo-item-ccu",
    plaidAccessToken: "demo-access-token-ccu",
    institutionName: "Coastal Credit Union",
    institutionId: "ins_demo_002",
    status: "active" as const,
    lastSyncedAt: new Date(),
  },
];

const DEMO_ACCOUNTS = [
  {
    id: DEMO_ACCT_CHECKING,
    institutionId: DEMO_INST_ID_1,
    plaidAccountId: "demo-acct-checking",
    name: "Checking",
    officialName: "First National Checking Account",
    type: "depository",
    subtype: "checking",
    currentBalance: "3247.82",
    availableBalance: "3247.82",
    creditLimit: null,
    isActive: true,
  },
  {
    id: DEMO_ACCT_SAVINGS,
    institutionId: DEMO_INST_ID_1,
    plaidAccountId: "demo-acct-savings",
    name: "High-Yield Savings",
    officialName: "First National High-Yield Savings",
    type: "depository",
    subtype: "savings",
    currentBalance: "8540.00",
    availableBalance: "8540.00",
    creditLimit: null,
    isActive: true,
  },
  {
    id: DEMO_ACCT_VISA,
    institutionId: DEMO_INST_ID_2,
    plaidAccountId: "demo-acct-visa",
    name: "Visa Signature",
    officialName: "Coastal Visa Signature Rewards",
    type: "credit",
    subtype: "credit card",
    currentBalance: "1284.50",
    availableBalance: "3715.50",
    creditLimit: "5000.00",
    isActive: true,
  },
  {
    id: DEMO_ACCT_MC,
    institutionId: DEMO_INST_ID_1,
    plaidAccountId: "demo-acct-mc",
    name: "Cashback Mastercard",
    officialName: "First National Cashback Mastercard",
    type: "credit",
    subtype: "credit card",
    currentBalance: "432.10",
    availableBalance: "7567.90",
    creditLimit: "8000.00",
    isActive: true,
  },
];

// ─── Transaction templates ─────────────────────────────────────────────────────
// One entry per recurring monthly transaction. Generated for each of the last 6 months.

interface TxTemplate {
  key: string;
  accountId: string;
  name: string;
  merchantName: string;
  category: string;
  categoryDetailed: string;
  amount: string;
  day: number;
  paymentChannel: string;
}

const TX_TEMPLATES: TxTemplate[] = [
  // ── Checking: recurring bills ──────────────────────────────────────────────
  { key: "rent",    accountId: DEMO_ACCT_CHECKING, name: "Pine Street Apartments", merchantName: "Pine Street Apartments", category: "RENT_AND_UTILITIES", categoryDetailed: "RENT_AND_UTILITIES_RENT", amount: "1800.00", day: 1, paymentChannel: "online" },
  { key: "elec",    accountId: DEMO_ACCT_CHECKING, name: "Eversource Energy", merchantName: "Eversource", category: "RENT_AND_UTILITIES", categoryDetailed: "RENT_AND_UTILITIES_UTILITIES", amount: "83.47", day: 5, paymentChannel: "online" },
  { key: "isp",     accountId: DEMO_ACCT_CHECKING, name: "Comcast Internet", merchantName: "Comcast", category: "RENT_AND_UTILITIES", categoryDetailed: "RENT_AND_UTILITIES_UTILITIES", amount: "79.99", day: 3, paymentChannel: "online" },

  // ── Checking: groceries ───────────────────────────────────────────────────
  { key: "wfm1",    accountId: DEMO_ACCT_CHECKING, name: "Whole Foods Market", merchantName: "Whole Foods Market", category: "FOOD_AND_DRINK", categoryDetailed: "FOOD_AND_DRINK_GROCERIES", amount: "64.83", day: 8, paymentChannel: "in store" },
  { key: "tjs",     accountId: DEMO_ACCT_CHECKING, name: "Trader Joe's", merchantName: "Trader Joe's", category: "FOOD_AND_DRINK", categoryDetailed: "FOOD_AND_DRINK_GROCERIES", amount: "52.17", day: 15, paymentChannel: "in store" },
  { key: "wfm2",    accountId: DEMO_ACCT_CHECKING, name: "Whole Foods Market", merchantName: "Whole Foods Market", category: "FOOD_AND_DRINK", categoryDetailed: "FOOD_AND_DRINK_GROCERIES", amount: "55.90", day: 23, paymentChannel: "in store" },

  // ── Checking: dining out ──────────────────────────────────────────────────
  { key: "chipotle",accountId: DEMO_ACCT_CHECKING, name: "Chipotle Mexican Grill", merchantName: "Chipotle", category: "FOOD_AND_DRINK", categoryDetailed: "FOOD_AND_DRINK_RESTAURANTS", amount: "23.45", day: 7, paymentChannel: "in store" },
  { key: "sweet",   accountId: DEMO_ACCT_CHECKING, name: "Sweetgreen", merchantName: "Sweetgreen", category: "FOOD_AND_DRINK", categoryDetailed: "FOOD_AND_DRINK_RESTAURANTS", amount: "17.90", day: 13, paymentChannel: "in store" },
  { key: "shakeshack",accountId: DEMO_ACCT_CHECKING, name: "Shake Shack", merchantName: "Shake Shack", category: "FOOD_AND_DRINK", categoryDetailed: "FOOD_AND_DRINK_RESTAURANTS", amount: "28.70", day: 19, paymentChannel: "in store" },
  { key: "sushi",   accountId: DEMO_ACCT_CHECKING, name: "Nobu Restaurant", merchantName: "Nobu", category: "FOOD_AND_DRINK", categoryDetailed: "FOOD_AND_DRINK_RESTAURANTS", amount: "94.00", day: 26, paymentChannel: "in store" },

  // ── Checking: coffee ──────────────────────────────────────────────────────
  { key: "sbx1",    accountId: DEMO_ACCT_CHECKING, name: "Starbucks", merchantName: "Starbucks", category: "FOOD_AND_DRINK", categoryDetailed: "FOOD_AND_DRINK_COFFEE", amount: "8.50", day: 6, paymentChannel: "in store" },
  { key: "sbx2",    accountId: DEMO_ACCT_CHECKING, name: "Starbucks", merchantName: "Starbucks", category: "FOOD_AND_DRINK", categoryDetailed: "FOOD_AND_DRINK_COFFEE", amount: "9.25", day: 13, paymentChannel: "in store" },
  { key: "sbx3",    accountId: DEMO_ACCT_CHECKING, name: "Starbucks", merchantName: "Starbucks", category: "FOOD_AND_DRINK", categoryDetailed: "FOOD_AND_DRINK_COFFEE", amount: "7.75", day: 20, paymentChannel: "in store" },
  { key: "bluebottle",accountId: DEMO_ACCT_CHECKING, name: "Blue Bottle Coffee", merchantName: "Blue Bottle Coffee", category: "FOOD_AND_DRINK", categoryDetailed: "FOOD_AND_DRINK_COFFEE", amount: "6.50", day: 27, paymentChannel: "in store" },

  // ── Checking: transport ───────────────────────────────────────────────────
  { key: "shell",   accountId: DEMO_ACCT_CHECKING, name: "Shell", merchantName: "Shell", category: "TRANSPORTATION", categoryDetailed: "TRANSPORTATION_GAS_STATIONS", amount: "51.40", day: 10, paymentChannel: "in store" },
  { key: "bp",      accountId: DEMO_ACCT_CHECKING, name: "BP Gas Station", merchantName: "BP", category: "TRANSPORTATION", categoryDetailed: "TRANSPORTATION_GAS_STATIONS", amount: "48.90", day: 25, paymentChannel: "in store" },
  { key: "uber",    accountId: DEMO_ACCT_CHECKING, name: "Uber", merchantName: "Uber", category: "TRANSPORTATION", categoryDetailed: "TRANSPORTATION_TAXI", amount: "24.30", day: 11, paymentChannel: "online" },

  // ── Visa: shopping ────────────────────────────────────────────────────────
  { key: "amz1",    accountId: DEMO_ACCT_VISA, name: "Amazon.com", merchantName: "Amazon", category: "GENERAL_MERCHANDISE", categoryDetailed: "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES", amount: "89.99", day: 4, paymentChannel: "online" },
  { key: "amz2",    accountId: DEMO_ACCT_VISA, name: "Amazon.com", merchantName: "Amazon", category: "GENERAL_MERCHANDISE", categoryDetailed: "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES", amount: "124.50", day: 18, paymentChannel: "online" },
  { key: "target",  accountId: DEMO_ACCT_VISA, name: "Target", merchantName: "Target", category: "SHOPS", categoryDetailed: "SHOPS_DEPARTMENT_STORES", amount: "67.32", day: 9, paymentChannel: "in store" },

  // ── Visa: subscriptions & entertainment ───────────────────────────────────
  { key: "netflix", accountId: DEMO_ACCT_VISA, name: "Netflix.com", merchantName: "Netflix", category: "ENTERTAINMENT", categoryDetailed: "ENTERTAINMENT_STREAMING_SERVICES", amount: "15.49", day: 14, paymentChannel: "online" },
  { key: "spotify", accountId: DEMO_ACCT_VISA, name: "Spotify USA", merchantName: "Spotify", category: "ENTERTAINMENT", categoryDetailed: "ENTERTAINMENT_STREAMING_SERVICES", amount: "9.99", day: 14, paymentChannel: "online" },
  { key: "gym",     accountId: DEMO_ACCT_VISA, name: "Life Time Fitness", merchantName: "Life Time", category: "RECREATION", categoryDetailed: "RECREATION_FITNESS_CLUBS", amount: "45.00", day: 1, paymentChannel: "online" },
  { key: "amc",     accountId: DEMO_ACCT_VISA, name: "AMC Theatres", merchantName: "AMC", category: "ENTERTAINMENT", categoryDetailed: "ENTERTAINMENT_MOVIES_DVDS", amount: "32.50", day: 20, paymentChannel: "in store" },

  // ── Mastercard: health & misc ─────────────────────────────────────────────
  { key: "cvs",     accountId: DEMO_ACCT_MC, name: "CVS Pharmacy", merchantName: "CVS", category: "HEALTHCARE", categoryDetailed: "HEALTHCARE_PHARMACIES", amount: "24.18", day: 12, paymentChannel: "in store" },
  { key: "instacart",accountId: DEMO_ACCT_MC, name: "Instacart", merchantName: "Instacart", category: "FOOD_AND_DRINK", categoryDetailed: "FOOD_AND_DRINK_GROCERIES", amount: "78.40", day: 16, paymentChannel: "online" },
  { key: "homedepot",accountId: DEMO_ACCT_MC, name: "The Home Depot", merchantName: "Home Depot", category: "SHOPS", categoryDetailed: "SHOPS_HARDWARE_STORES", amount: "44.67", day: 22, paymentChannel: "in store" },
];

// ─── Current-month partial transactions (day ≤ today) ──────────────────────────

interface CurrentMonthTx {
  key: string;
  accountId: string;
  name: string;
  merchantName: string;
  category: string;
  categoryDetailed: string;
  amount: string;
  date: string;
  paymentChannel: string;
}

function buildCurrentMonthTxs(): CurrentMonthTx[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const todayDay = now.getDate();

  return TX_TEMPLATES
    .filter((t) => t.day <= todayDay)
    .map((t) => ({
      key: t.key,
      accountId: t.accountId,
      name: t.name,
      merchantName: t.merchantName,
      category: t.category,
      categoryDetailed: t.categoryDetailed,
      amount: t.amount,
      date: d(year, month, t.day),
      paymentChannel: t.paymentChannel,
    }));
}

// ─── Balance snapshots ─────────────────────────────────────────────────────────

function buildBalanceSnapshots(): Array<{
  accountId: string;
  snapshotDate: string;
  currentBalance: string;
  availableBalance: string;
}> {
  const rows = [];
  const DAYS = 91;

  for (let i = DAYS; i >= 0; i--) {
    const dateStr = daysAgo(i);
    const t = i / DAYS; // 0 = today, 1 = 91 days ago

    // Checking: oscillates around $3,000, trending up slightly
    const checkingBase = 2600 + (1 - t) * 650;
    const checkingWave = Math.sin((i / 14) * Math.PI) * 350;
    const checking = (checkingBase + checkingWave).toFixed(2);

    // Savings: steady growth
    const savings = (7180 + (1 - t) * 1360).toFixed(2);

    // Visa: builds up mid-month, paid down at start
    const visaWave = Math.abs(Math.sin((i / 15) * Math.PI)) * 900 + 500;
    const visa = visaWave.toFixed(2);

    // Mastercard: similar but smaller
    const mcWave = Math.abs(Math.sin((i / 18) * Math.PI)) * 300 + 180;
    const mc = mcWave.toFixed(2);

    rows.push(
      { accountId: DEMO_ACCT_CHECKING, snapshotDate: dateStr, currentBalance: checking, availableBalance: checking },
      { accountId: DEMO_ACCT_SAVINGS,  snapshotDate: dateStr, currentBalance: savings,  availableBalance: savings },
      { accountId: DEMO_ACCT_VISA,     snapshotDate: dateStr, currentBalance: visa,     availableBalance: (5000 - parseFloat(visa)).toFixed(2) },
      { accountId: DEMO_ACCT_MC,       snapshotDate: dateStr, currentBalance: mc,       availableBalance: (8000 - parseFloat(mc)).toFixed(2) },
    );
  }
  return rows;
}

// ─── Recurring items ───────────────────────────────────────────────────────────

function buildRecurringItems() {
  const now = new Date();
  const thisMonth1st = d(now.getFullYear(), now.getMonth() + 1, 1);

  return [
    { id: "d0000000-0002-4000-8000-000000000001", accountId: DEMO_ACCT_CHECKING, name: "Pine Street Apartments", merchantName: "Pine Street Apartments", amount: "1800.00", frequency: "monthly", lastDate: d(now.getFullYear(), now.getMonth() + 1, 1), nextProjectedDate: nextMonth(thisMonth1st), isActive: true, isUserConfirmed: true },
    { id: "d0000000-0002-4000-8000-000000000002", accountId: DEMO_ACCT_CHECKING, name: "Comcast Internet", merchantName: "Comcast", amount: "79.99", frequency: "monthly", lastDate: d(now.getFullYear(), now.getMonth() + 1, 3), nextProjectedDate: nextMonth(d(now.getFullYear(), now.getMonth() + 1, 3)), isActive: true, isUserConfirmed: true },
    { id: "d0000000-0002-4000-8000-000000000003", accountId: DEMO_ACCT_CHECKING, name: "Eversource Energy", merchantName: "Eversource", amount: "83.47", frequency: "monthly", lastDate: d(now.getFullYear(), now.getMonth() + 1, 5), nextProjectedDate: nextMonth(d(now.getFullYear(), now.getMonth() + 1, 5)), isActive: true, isUserConfirmed: false },
    { id: "d0000000-0002-4000-8000-000000000004", accountId: DEMO_ACCT_VISA, name: "Netflix.com", merchantName: "Netflix", amount: "15.49", frequency: "monthly", lastDate: d(now.getFullYear(), now.getMonth() + 1, 14), nextProjectedDate: nextMonth(d(now.getFullYear(), now.getMonth() + 1, 14)), isActive: true, isUserConfirmed: true },
    { id: "d0000000-0002-4000-8000-000000000005", accountId: DEMO_ACCT_VISA, name: "Spotify USA", merchantName: "Spotify", amount: "9.99", frequency: "monthly", lastDate: d(now.getFullYear(), now.getMonth() + 1, 14), nextProjectedDate: nextMonth(d(now.getFullYear(), now.getMonth() + 1, 14)), isActive: true, isUserConfirmed: true },
    { id: "d0000000-0002-4000-8000-000000000006", accountId: DEMO_ACCT_VISA, name: "Life Time Fitness", merchantName: "Life Time", amount: "45.00", frequency: "monthly", lastDate: d(now.getFullYear(), now.getMonth() + 1, 1), nextProjectedDate: nextMonth(thisMonth1st), isActive: true, isUserConfirmed: true },
    // Flagged: hasn't been seen in 4 months
    { id: "d0000000-0002-4000-8000-000000000007", accountId: DEMO_ACCT_VISA, name: "Adobe Creative Cloud", merchantName: "Adobe", amount: "54.99", frequency: "monthly", lastDate: daysAgo(120), nextProjectedDate: daysAgo(90), isActive: true, isUserConfirmed: false },
  ];
}

// ─── Budget goals ──────────────────────────────────────────────────────────────

const DEMO_BUDGET_GOALS = [
  {
    id: "d0000000-0003-4000-8000-000000000001",
    category: "FOOD_AND_DRINK",
    categoryLabel: "Food & Drink",
    targetType: "cap",
    monthlyTarget: "420.00",
    baselineMonthlySpend: "515.00",
    rationale: "Your food & drink spend averages $515/month. Reducing dining out by 2 meals per week could save ~$95/month.",
    status: "suggested",
    generatedAt: new Date(),
  },
  {
    id: "d0000000-0003-4000-8000-000000000002",
    category: "GENERAL_MERCHANDISE",
    categoryLabel: "Shopping",
    targetType: "percent_reduction",
    monthlyTarget: "175.00",
    baselineMonthlySpend: "215.00",
    rationale: "Amazon and Target purchases total $215/month. Applying a 48-hour rule before purchases could trim this 20%.",
    status: "suggested",
    generatedAt: new Date(),
  },
  {
    id: "d0000000-0003-4000-8000-000000000003",
    category: "ENTERTAINMENT",
    categoryLabel: "Entertainment & Subscriptions",
    targetType: "cap",
    monthlyTarget: "50.00",
    baselineMonthlySpend: "57.98",
    rationale: "Streaming and entertainment runs $58/month. Auditing unused subscriptions (Adobe hasn't charged in 4 months) could bring this under $50.",
    status: "suggested",
    generatedAt: new Date(),
  },
];

// ─── Savings targets ───────────────────────────────────────────────────────────

function buildSavingsTargets() {
  const japanDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 9);
    return d.toISOString().slice(0, 10);
  })();
  const emergencyDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().slice(0, 10);
  })();

  return [
    {
      id: "d0000000-0004-4000-8000-000000000001",
      name: "Japan trip",
      targetAmount: "3500.00",
      targetDate: japanDate,
      monthlyAmount: "389.00",
      budgetPlanId: null,
    },
    {
      id: "d0000000-0004-4000-8000-000000000002",
      name: "Emergency fund top-up",
      targetAmount: "2000.00",
      targetDate: emergencyDate,
      monthlyAmount: "334.00",
      budgetPlanId: null,
    },
  ];
}

// ─── Main seed function ────────────────────────────────────────────────────────

export async function isDemoSeeded(): Promise<boolean> {
  const rows = await db
    .select({ id: institutions.id })
    .from(institutions)
    .where(eq(institutions.id, DEMO_INST_ID_1))
    .limit(1);
  return rows.length > 0;
}

export async function seedDemoData(): Promise<void> {
  if (await isDemoSeeded()) return;

  console.log("[demo] Seeding demo data...");

  // 1. Institutions
  await db.insert(institutions).values(DEMO_INSTITUTIONS).onConflictDoNothing();

  // 2. Accounts
  await db.insert(accounts).values(DEMO_ACCOUNTS).onConflictDoNothing();

  // 3. Transactions — 6 complete months + current month partial
  const months = lastNMonths(6);
  const txRows = [];
  let seq = 1;

  for (const { year, month } of months) {
    for (const t of TX_TEMPLATES) {
      txRows.push({
        id: `d${String(seq++).padStart(7, "0")}-0005-4000-8000-000000000000`,
        accountId: t.accountId,
        plaidTransactionId: `demo-tx-${t.key}-${year}-${month}`,
        amount: t.amount,
        date: d(year, month, t.day),
        name: t.name,
        merchantName: t.merchantName,
        category: t.category,
        categoryDetailed: t.categoryDetailed,
        pending: false,
        paymentChannel: t.paymentChannel,
      });
    }
  }

  // Current month — only days that have passed
  for (const t of buildCurrentMonthTxs()) {
    const now = new Date();
    txRows.push({
      id: `d${String(seq++).padStart(7, "0")}-0005-4000-8000-000000000000`,
      accountId: t.accountId,
      plaidTransactionId: `demo-tx-${t.key}-${now.getFullYear()}-${now.getMonth() + 1}-curr`,
      amount: t.amount,
      date: t.date,
      name: t.name,
      merchantName: t.merchantName,
      category: t.category,
      categoryDetailed: t.categoryDetailed,
      pending: false,
      paymentChannel: t.paymentChannel,
    });
  }

  // Insert in batches to avoid hitting param limits
  for (let i = 0; i < txRows.length; i += 50) {
    await db.insert(transactions).values(txRows.slice(i, i + 50)).onConflictDoNothing();
  }

  // 4. Balance snapshots
  const snapshots = buildBalanceSnapshots();
  for (let i = 0; i < snapshots.length; i += 100) {
    await db.insert(balanceSnapshots).values(snapshots.slice(i, i + 100)).onConflictDoNothing();
  }

  // 5. Recurring items
  await db.insert(recurringItems).values(buildRecurringItems()).onConflictDoNothing();

  // 6. Budget goals
  await db.insert(budgetGoals).values(DEMO_BUDGET_GOALS).onConflictDoNothing();

  // 7. Savings targets
  await db.insert(savingsTargets).values(buildSavingsTargets()).onConflictDoNothing();

  console.log(`[demo] Seeded ${txRows.length} transactions + snapshots + recurring + goals.`);
}
