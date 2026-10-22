import { COUNTRIES, isLiability } from "./countries";

/** FX rates as units of each currency per 1 USD. USD is always 1. */
export type Rates = Record<string, number>;

export function convert(amount: number, from: string, to: string, rates: Rates): number {
  if (from === to) return amount;
  const f = rates[from];
  const t = rates[to];
  if (!f || !t) throw new Error(`Missing FX rate for ${!f ? from : to}`);
  return (amount / f) * t;
}

export interface Holding {
  country: string;
  type: string;
  currency: string;
  /** Always positive; liabilities are subtracted by type. */
  balance: number;
}

export interface Totals {
  /** Net worth in each requested currency. */
  net: Record<string, number>;
  assets: Record<string, number>;
  liabilities: Record<string, number>;
  /** Net worth by country, in the first requested currency. */
  byCountry: Record<string, number>;
  /** Net worth by account type, in the first requested currency. */
  byType: Record<string, number>;
  /** Currencies that couldn't be converted (no FX rate); their accounts are left out. */
  unconverted: string[];
}

/** `currencies` must all have rates; accounts in currencies without a rate are skipped and reported. */
export function computeTotals(items: Holding[], currencies: string[], rates: Rates): Totals {
  const zero = () => Object.fromEntries(currencies.map((c) => [c, 0]));
  const totals: Totals = { net: zero(), assets: zero(), liabilities: zero(), byCountry: {}, byType: {}, unconverted: [] };
  const primary = currencies[0];
  const missing = new Set<string>();
  for (const it of items) {
    if (!rates[it.currency]) {
      missing.add(it.currency);
      continue;
    }
    const sign = isLiability(it.country, it.type) ? -1 : 1;
    for (const cur of currencies) {
      const v = convert(it.balance, it.currency, cur, rates);
      totals.net[cur] += sign * v;
      if (sign > 0) totals.assets[cur] += v;
      else totals.liabilities[cur] += v;
    }
    const p = sign * convert(it.balance, it.currency, primary, rates);
    totals.byCountry[it.country] = (totals.byCountry[it.country] ?? 0) + p;
    totals.byType[it.type] = (totals.byType[it.type] ?? 0) + p;
  }
  totals.unconverted = [...missing];
  return totals;
}

const LOCALE_BY_CURRENCY: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.currency, c.locale]),
);

export function formatMoney(amount: number, currency: string, opts: { compact?: boolean } = {}): string {
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency] ?? "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: opts.compact ? 0 : 2,
  }).format(amount);
}

/** Parse "6,39,144.64", "₹ 1,234", "$12.50" etc. Returns NaN when not a number. */
export function parseAmount(text: string): number {
  const cleaned = text.replace(/[^\d.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return NaN;
  return Number(cleaned);
}
