import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  boolean,
  date,
  index,
  unique,
} from "drizzle-orm/pg-core";

export const institutions = pgTable("institutions", {
  id: uuid("id").primaryKey().defaultRandom(),
  plaidItemId: text("plaid_item_id").notNull().unique(),
  plaidAccessToken: text("plaid_access_token").notNull(), // AES-256-GCM encrypted
  institutionName: text("institution_name").notNull(),
  institutionId: text("institution_id").notNull(), // Plaid institution_id
  syncCursor: text("sync_cursor"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  status: text("status").notNull().default("active"), // active | error | relink_required
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id, { onDelete: "cascade" }),
  plaidAccountId: text("plaid_account_id").notNull().unique(),
  name: text("name").notNull(),
  officialName: text("official_name"),
  type: text("type").notNull(), // depository | credit | investment | loan
  subtype: text("subtype"),
  currencyCode: text("currency_code").notNull().default("USD"),
  currentBalance: numeric("current_balance", { precision: 14, scale: 2 }),
  availableBalance: numeric("available_balance", { precision: 14, scale: 2 }),
  creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    plaidTransactionId: text("plaid_transaction_id").notNull().unique(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currencyCode: text("currency_code").notNull().default("USD"),
    date: date("date").notNull(),
    name: text("name").notNull(),
    merchantName: text("merchant_name"),
    category: text("category"),
    categoryDetailed: text("category_detailed"),
    pending: boolean("pending").notNull().default(false),
    paymentChannel: text("payment_channel"),
    logoUrl: text("logo_url"),
    website: text("website"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    accountIdIdx: index("idx_transactions_account_id").on(table.accountId),
    dateIdx: index("idx_transactions_date").on(table.date),
    pendingIdx: index("idx_transactions_pending").on(table.pending),
  })
);

export const balanceSnapshots = pgTable(
  "balance_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date").notNull(),
    currentBalance: numeric("current_balance", { precision: 14, scale: 2 }),
    availableBalance: numeric("available_balance", { precision: 14, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    dateIdx: index("idx_balance_snapshots_date").on(table.snapshotDate),
    accountDateIdx: index("idx_balance_snapshots_account").on(
      table.accountId,
      table.snapshotDate
    ),
    uniqueAccountDate: unique().on(table.accountId, table.snapshotDate),
  })
);

export const recurringItems = pgTable("recurring_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  merchantName: text("merchant_name"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  frequency: text("frequency").notNull(), // weekly | biweekly | monthly | annually
  lastDate: date("last_date"),
  nextProjectedDate: date("next_projected_date"),
  isActive: boolean("is_active").notNull().default(true),
  isUserConfirmed: boolean("is_user_confirmed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
