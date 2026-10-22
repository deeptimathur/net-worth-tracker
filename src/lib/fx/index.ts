import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { SUPPORTED_CURRENCIES } from "../countries";
import { getDb, schema } from "../db";
import type { Rates } from "../money";

export interface RateSet {
  rates: Rates;
  /** Day the rates are for (YYYY-MM-DD), or null if none were ever fetched. */
  day: string | null;
  source: string;
  stale: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Fetch USD-based reference rates. Frankfurter serves ECB rates (incl. INR), free and keyless. */
export async function fetchRates(quotes: string[], fetchImpl: typeof fetch = fetch): Promise<{ day: string; rates: Rates }> {
  const base = process.env.FX_API_URL ?? "https://api.frankfurter.dev/v1/latest";
  const url = `${base}?base=USD&symbols=${quotes.join(",")}`;
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`FX fetch failed: ${res.status}`);
  const body = (await res.json()) as { date: string; rates: Record<string, number> };
  for (const q of quotes) {
    if (typeof body.rates?.[q] !== "number" || !(body.rates[q] > 0)) throw new Error(`FX response missing ${q}`);
  }
  return { day: body.date, rates: { USD: 1, ...body.rates } };
}

/**
 * Today's rates for every supported currency. Rates are shared by all users and cached in
 * the database, so the upstream API is called at most about once a day.
 */
export async function getRates(): Promise<RateSet> {
  const db = getDb();
  const quotes = SUPPORTED_CURRENCIES.filter((c) => c !== "USD");
  const [latest] = await db.select().from(schema.fxRates).orderBy(desc(schema.fxRates.fetchedAt)).limit(1);
  const fetchedToday = latest && latest.fetchedAt.toISOString().slice(0, 10) === today();

  if (!fetchedToday && quotes.length) {
    try {
      const { day, rates } = await fetchRates(quotes);
      await db
        .insert(schema.fxRates)
        .values(quotes.map((q) => ({ day, quote: q, rate: String(rates[q]), source: "ECB via Frankfurter" })))
        .onConflictDoUpdate({
          target: [schema.fxRates.day, schema.fxRates.quote],
          set: { fetchedAt: new Date() },
        });
    } catch (err) {
      console.warn("FX refresh failed, using last stored rates", err);
    }
  }

  const [newest] = await db.select().from(schema.fxRates).orderBy(desc(schema.fxRates.day)).limit(1);
  if (!newest) return { rates: { USD: 1 }, day: null, source: "none", stale: true };
  const rows = await db
    .select()
    .from(schema.fxRates)
    .where(eq(schema.fxRates.day, newest.day));
  const rates: Rates = { USD: 1 };
  for (const r of rows) rates[r.quote] = Number(r.rate);
  // Fill any currency missing on that day from its most recent value.
  const missing = quotes.filter((q) => !(q in rates));
  if (missing.length) {
    const older = await db
      .select()
      .from(schema.fxRates)
      .where(inArray(schema.fxRates.quote, missing))
      .orderBy(desc(schema.fxRates.day));
    for (const r of older) if (!(r.quote in rates)) rates[r.quote] = Number(r.rate);
  }
  const ageDays = (Date.now() - Date.parse(newest.day)) / 86_400_000;
  // ECB doesn't publish on weekends/holidays, so allow a few days before calling it stale.
  return { rates, day: newest.day, source: newest.source, stale: ageDays > 4 };
}
