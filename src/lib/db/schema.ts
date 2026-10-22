import { date, index, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  /** Null for accounts that only sign in with Google. */
  passwordHash: text("password_hash"),
  /** Google account id ("sub"), once the user has signed in with Google. */
  googleSub: text("google_sub").unique(),
  name: text("name").notNull().default(""),
  /** This user's data key, wrapped under APP_ENCRYPTION_KEY. */
  wrappedDek: text("wrapped_dek").notNull(),
  /** Currencies totals are shown in, e.g. ["USD","INR"]. */
  displayCurrencies: text("display_currencies").array().notNull().default(["USD", "INR"]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the cookie token; the token itself is never stored. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** A Plaid connection to one institution. */
export const plaidItems = pgTable(
  "plaid_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull().unique(),
    /** "bank" (depository + credit) or "investments". */
    kind: text("kind").notNull(),
    /** Encrypted PlaidItemSecret JSON (access token, institution name). */
    data: text("data").notNull(),
    /** "ok", "login_required" or "error". */
    status: text("status").notNull().default("ok"),
    lastError: text("last_error"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("plaid_items_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    country: text("country").notNull(),
    type: text("type").notNull(),
    currency: text("currency").notNull(),
    /** Encrypted AccountSecret JSON (institution, nickname, balance, holdings). */
    data: text("data").notNull(),
    asOf: date("as_of"),
    /** "manual" or an importer id such as "cas". */
    source: text("source").notNull().default("manual"),
    /** Provider's account id (e.g. Plaid account_id) for linked accounts. */
    externalId: text("external_id"),
    plaidItemId: uuid("plaid_item_id").references(() => plaidItems.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("accounts_user_idx").on(t.userId), uniqueIndex("accounts_user_external_idx").on(t.userId, t.externalId)],
);

/** Shared daily FX reference rates (not user data). Units of `quote` per 1 USD. */
export const fxRates = pgTable(
  "fx_rates",
  {
    day: date("day").notNull(),
    quote: text("quote").notNull(),
    rate: numeric("rate", { precision: 20, scale: 8 }).notNull(),
    source: text("source").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.day, t.quote] })],
);

/** One net worth reading per user per month. */
export const snapshots = pgTable(
  "snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** First day of the month (YYYY-MM-01). */
    month: date("month").notNull(),
    /** "auto" (recorded from live balances) or "entered" (typed in for a past month). */
    source: text("source").notNull(),
    /** Encrypted SnapshotSecret JSON. */
    data: text("data").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("snapshots_user_month_idx").on(t.userId, t.month)],
);
