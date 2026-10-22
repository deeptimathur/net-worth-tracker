import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { SessionUser } from "../auth/session";
import { createAccount, updateAccount } from "../accounts";
import { decryptJson, encryptJson, unwrapDataKey } from "../crypto/envelope";
import { getDb, schema } from "../db";
import { getPlaid, plaidErrorCode } from "./client";
import { mapAccounts } from "./map";

export type LinkKind = "bank" | "investments";

interface PlaidItemSecret {
  accessToken: string;
  institutionName: string;
}

export interface PlaidItem {
  id: string;
  itemId: string;
  kind: LinkKind;
  institutionName: string;
  status: string;
  lastError: string | null;
  lastSyncedAt: Date | null;
}

type ItemOwner = Pick<SessionUser, "id" | "wrappedDek">;
const aad = (userId: string) => `plaid:${userId}`;

function secretOf(user: ItemOwner, data: string): PlaidItemSecret {
  return decryptJson<PlaidItemSecret>(unwrapDataKey(user.wrappedDek, user.id), data, aad(user.id));
}

export async function listItems(user: SessionUser): Promise<PlaidItem[]> {
  const rows = await getDb()
    .select()
    .from(schema.plaidItems)
    .where(eq(schema.plaidItems.userId, user.id))
    .orderBy(asc(schema.plaidItems.createdAt));
  return rows.map((r) => ({
    id: r.id,
    itemId: r.itemId,
    kind: r.kind as LinkKind,
    institutionName: secretOf(user, r.data).institutionName,
    status: r.status,
    lastError: r.lastError,
    lastSyncedAt: r.lastSyncedAt,
  }));
}

async function getItemRow(user: ItemOwner, id: string) {
  const [row] = await getDb()
    .select()
    .from(schema.plaidItems)
    .where(and(eq(schema.plaidItems.id, id), eq(schema.plaidItems.userId, user.id)));
  return row;
}

export async function getAccessToken(user: SessionUser, id: string): Promise<string | undefined> {
  const row = await getItemRow(user, id);
  return row ? secretOf(user, row.data).accessToken : undefined;
}

/** Exchange Link's public token and store the encrypted access token. Returns the new item's id. */
export async function addItem(user: SessionUser, publicToken: string, kind: LinkKind, institutionName: string) {
  const plaid = getPlaid();
  const { data } = await plaid.itemPublicTokenExchange({ public_token: publicToken });
  const secret: PlaidItemSecret = { accessToken: data.access_token, institutionName };
  const [row] = await getDb()
    .insert(schema.plaidItems)
    .values({
      userId: user.id,
      itemId: data.item_id,
      kind,
      data: encryptJson(unwrapDataKey(user.wrappedDek, user.id), secret, aad(user.id)),
    })
    .returning({ id: schema.plaidItems.id });
  return row.id;
}

export interface SyncResult {
  updated: number;
  created: number;
  skipped: string[];
  error?: string;
}

/**
 * Pull balances for one item into the user's accounts. Uses /accounts/get, which returns the
 * balances Plaid last refreshed (several times a day) and isn't billed per call.
 */
export async function syncItem(user: SessionUser, id: string): Promise<SyncResult> {
  const row = await getItemRow(user, id);
  if (!row) return { updated: 0, created: 0, skipped: [], error: "Connection not found" };
  const { accessToken, institutionName } = secretOf(user, row.data);
  const db = getDb();
  try {
    const { data } = await getPlaid().accountsGet({ access_token: accessToken });
    const { mapped, skipped } = mapAccounts(data.accounts);
    const existing = await db
      .select({ id: schema.accounts.id, externalId: schema.accounts.externalId })
      .from(schema.accounts)
      .where(and(eq(schema.accounts.userId, user.id), eq(schema.accounts.plaidItemId, row.id)));
    const byExternal = new Map(existing.map((e) => [e.externalId, e.id]));
    const asOf = new Date().toISOString().slice(0, 10);
    let updated = 0;
    let created = 0;
    for (const m of mapped) {
      const input = {
        country: "US",
        type: m.type,
        currency: m.currency,
        institution: institutionName,
        nickname: m.nickname,
        balance: m.balance,
        refTail: m.refTail,
        asOf,
        source: "plaid",
      };
      const accountId = byExternal.get(m.externalId);
      if (accountId) {
        await updateAccount(user, accountId, input);
        updated++;
      } else {
        await createAccount(user, input, { externalId: m.externalId, plaidItemId: row.id });
        created++;
      }
    }
    await db
      .update(schema.plaidItems)
      .set({ status: "ok", lastError: null, lastSyncedAt: new Date() })
      .where(eq(schema.plaidItems.id, row.id));
    return { updated, created, skipped };
  } catch (err) {
    const code = plaidErrorCode(err);
    const status = code === "ITEM_LOGIN_REQUIRED" || code === "PENDING_EXPIRATION" ? "login_required" : "error";
    await db
      .update(schema.plaidItems)
      .set({ status, lastError: code ?? (err as Error).message.slice(0, 200) })
      .where(eq(schema.plaidItems.id, row.id));
    return { updated: 0, created: 0, skipped: [], error: code ?? "Plaid request failed" };
  }
}

/** Disconnect at Plaid (stops billing) and delete the item and its accounts here. */
export async function removeItem(user: SessionUser, id: string): Promise<void> {
  const row = await getItemRow(user, id);
  if (!row) return;
  try {
    await getPlaid().itemRemove({ access_token: secretOf(user, row.data).accessToken });
  } catch (err) {
    // Already removed at Plaid, or a revoked item; still clean up here.
    console.warn("Plaid itemRemove failed:", plaidErrorCode(err) ?? (err as Error).message);
  }
  await getDb()
    .delete(schema.plaidItems)
    .where(and(eq(schema.plaidItems.id, id), eq(schema.plaidItems.userId, user.id)));
}

/** Refresh every connected item (daily cron). */
export async function syncAllItems(): Promise<{ items: number; failed: number }> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.plaidItems.id,
      userId: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      wrappedDek: schema.users.wrappedDek,
      displayCurrencies: schema.users.displayCurrencies,
    })
    .from(schema.plaidItems)
    .innerJoin(schema.users, eq(schema.users.id, schema.plaidItems.userId));
  let failed = 0;
  for (const r of rows) {
    const user: SessionUser = { id: r.userId, email: r.email, name: r.name, wrappedDek: r.wrappedDek, displayCurrencies: r.displayCurrencies };
    const res = await syncItem(user, r.id);
    if (res.error) failed++;
  }
  return { items: rows.length, failed };
}
