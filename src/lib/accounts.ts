import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { SessionUser } from "./auth/session";
import { decryptJson, encryptJson, unwrapDataKey } from "./crypto/envelope";
import { getDb, schema } from "./db";

/** Fields stored encrypted. */
export interface AccountSecret {
  institution: string;
  nickname: string;
  balance: number;
  notes?: string;
  /** Last 4 of an account / BO id, used to match imports. Never the full number. */
  refTail?: string;
}

export interface Account extends AccountSecret {
  id: string;
  country: string;
  type: string;
  currency: string;
  asOf: string | null;
  source: string;
  updatedAt: Date;
}

export interface AccountInput extends AccountSecret {
  country: string;
  type: string;
  currency: string;
  asOf: string | null;
  source?: string;
}

const aad = (userId: string) => `account:${userId}`;

function dekFor(user: SessionUser): Buffer {
  return unwrapDataKey(user.wrappedDek, user.id);
}

function fromRow(user: SessionUser, dek: Buffer, r: typeof schema.accounts.$inferSelect): Account {
  return {
    ...decryptJson<AccountSecret>(dek, r.data, aad(user.id)),
    id: r.id,
    country: r.country,
    type: r.type,
    currency: r.currency,
    asOf: r.asOf,
    source: r.source,
    updatedAt: r.updatedAt,
  };
}

export async function listAccounts(user: SessionUser): Promise<Account[]> {
  const dek = dekFor(user);
  const rows = await getDb()
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.userId, user.id))
    .orderBy(asc(schema.accounts.country), asc(schema.accounts.createdAt));
  return rows.map((r) => fromRow(user, dek, r));
}

export async function getAccount(user: SessionUser, id: string): Promise<Account | undefined> {
  const [row] = await getDb()
    .select()
    .from(schema.accounts)
    .where(and(eq(schema.accounts.id, id), eq(schema.accounts.userId, user.id)))
    .limit(1);
  return row ? fromRow(user, dekFor(user), row) : undefined;
}

function toRow(user: SessionUser, input: AccountInput) {
  const { country, type, currency, asOf, source, ...secret } = input;
  return {
    country,
    type,
    currency,
    asOf,
    source: source ?? "manual",
    data: encryptJson(dekFor(user), secret satisfies AccountSecret, aad(user.id)),
    updatedAt: new Date(),
  };
}

export async function createAccount(user: SessionUser, input: AccountInput): Promise<string> {
  const [row] = await getDb()
    .insert(schema.accounts)
    .values({ ...toRow(user, input), userId: user.id })
    .returning({ id: schema.accounts.id });
  return row.id;
}

export async function updateAccount(user: SessionUser, id: string, input: AccountInput): Promise<void> {
  await getDb()
    .update(schema.accounts)
    .set(toRow(user, input))
    .where(and(eq(schema.accounts.id, id), eq(schema.accounts.userId, user.id)));
}

export async function deleteAccount(user: SessionUser, id: string): Promise<void> {
  await getDb()
    .delete(schema.accounts)
    .where(and(eq(schema.accounts.id, id), eq(schema.accounts.userId, user.id)));
}
