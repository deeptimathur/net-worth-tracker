import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import type { SessionUser } from "./auth/session";
import { decryptJson, encryptJson, unwrapDataKey } from "./crypto/envelope";
import { getDb, schema } from "./db";
import type { Rates } from "./money";

export interface SnapshotSecret {
  /** Net worth in each currency a rate was known for. */
  net: Record<string, number>;
  /** Net worth by country, in USD. */
  byCountry?: Record<string, number>;
  /** Rates used (units per USD), when known. */
  rates?: Rates;
}

export interface Snapshot extends SnapshotSecret {
  id: string;
  month: string;
  source: "auto" | "entered";
  updatedAt: Date;
}

const aad = (userId: string) => `snapshot:${userId}`;

export const monthOf = (d: Date | string) => `${(typeof d === "string" ? d : d.toISOString()).slice(0, 7)}-01`;

export async function listSnapshots(user: SessionUser): Promise<Snapshot[]> {
  const dek = unwrapDataKey(user.wrappedDek, user.id);
  const rows = await getDb()
    .select()
    .from(schema.snapshots)
    .where(eq(schema.snapshots.userId, user.id))
    .orderBy(asc(schema.snapshots.month));
  return rows.map((r) => ({
    ...decryptJson<SnapshotSecret>(dek, r.data, aad(user.id)),
    id: r.id,
    month: r.month,
    source: r.source as Snapshot["source"],
    updatedAt: r.updatedAt,
  }));
}

/**
 * Save a month's snapshot. Live ("auto") readings refresh through the month but never
 * replace a value the user typed in for that month.
 */
export async function saveSnapshot(
  user: SessionUser,
  month: string,
  source: Snapshot["source"],
  secret: SnapshotSecret,
): Promise<void> {
  const data = encryptJson(unwrapDataKey(user.wrappedDek, user.id), secret, aad(user.id));
  await getDb()
    .insert(schema.snapshots)
    .values({ userId: user.id, month: monthOf(month), source, data })
    .onConflictDoUpdate({
      target: [schema.snapshots.userId, schema.snapshots.month],
      set: { source, data, updatedAt: new Date() },
      setWhere: source === "auto" ? sql`${schema.snapshots.source} = 'auto'` : undefined,
    });
}

export async function deleteSnapshot(user: SessionUser, id: string): Promise<void> {
  await getDb()
    .delete(schema.snapshots)
    .where(and(eq(schema.snapshots.id, id), eq(schema.snapshots.userId, user.id)));
}
