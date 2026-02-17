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
  jsonb,
} from "drizzle-orm/pg-core";

export const institutions = pgTable("institutions", {
  id: uuid("id").primaryKey().defaultRandom(),
  plaidItemId: text("plaid_item_id").notNull().unique(),
  plaidAccessToken: text("plaid_access_token").notNull(), // encrypted at rest (AES-256-GCM)
  institutionName: text("institution_name").notNull(),
  institutionId: text("institution_id").notNull(),
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

export const budgetPlans = pgTable("budget_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  summaryText: text("summary_text"),
  messagesJson: jsonb("messages_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const expenseGroups = pgTable("expense_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  budgetPlanId: uuid("budget_plan_id").references(() => budgetPlans.id, { onDelete: "set null" }),
  dateFrom: date("date_from"),
  dateTo: date("date_to"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const expenseGroupMembers = pgTable(
  "expense_group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => expenseGroups.id, { onDelete: "cascade" }),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueGroupTransaction: unique().on(table.groupId, table.transactionId),
    groupIdIdx: index("idx_expense_group_members_group_id").on(table.groupId),
    transactionIdIdx: index("idx_expense_group_members_transaction_id").on(table.transactionId),
  })
);

export const savingsTargets = pgTable("savings_targets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  targetAmount: numeric("target_amount", { precision: 14, scale: 2 }).notNull(),
  targetDate: date("target_date").notNull(),
  monthlyAmount: numeric("monthly_amount", { precision: 14, scale: 2 }).notNull(),
  budgetPlanId: uuid("budget_plan_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userSettings = pgTable("user_settings", {
  id: text("id").primaryKey().default("default"),
  passwordHash: text("password_hash"),
  syncScheduleEnabled: boolean("sync_schedule_enabled").notNull().default(true),
  digestScheduleEnabled: boolean("digest_schedule_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    action: text("action").notNull(), // login | logout | password_change | institution_link | institution_delete | report_download
    ip: text("ip"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    createdAtIdx: index("idx_audit_log_created_at").on(table.createdAt),
    actionIdx: index("idx_audit_log_action").on(table.action),
  })
);

export const digests = pgTable("digests", {
  id: uuid("id").primaryKey().defaultRandom(),
  periodFrom: date("period_from").notNull(),
  periodTo: date("period_to").notNull(),
  summaryMarkdown: text("summary_markdown").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const budgetGoals = pgTable("budget_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: text("category").notNull(),
  categoryLabel: text("category_label").notNull(),
  targetType: text("target_type").notNull(), // 'cap' | 'percent_reduction' | 'savings'
  monthlyTarget: numeric("monthly_target", { precision: 14, scale: 2 }).notNull(),
  baselineMonthlySpend: numeric("baseline_monthly_spend", { precision: 14, scale: 2 }).notNull(),
  rationale: text("rationale").notNull(),
  status: text("status").notNull().default("suggested"), // 'suggested' | 'accepted' | 'dismissed'
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
