import { date, index, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
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
