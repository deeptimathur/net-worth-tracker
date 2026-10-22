import type { InflationSeries } from "./countries";

/** "2026-03-01" or "2026-03" → { y: 2026, m: 3 } */
function ym(month: string): { y: number; m: number } {
  const [y, m] = month.split("-").map(Number);
  return { y, m };
}

function rateFor(series: InflationSeries, year: number): number {
  if (year in series.annual) return series.annual[year];
  const years = Object.keys(series.annual).map(Number).sort((a, b) => a - b);
  // Before the table starts, use its first year; after it ends, carry the last year forward.
  return series.annual[year < years[0] ? years[0] : years[years.length - 1]];
}

/**
 * How much prices rose between two months, as a multiplier (1.05 = 5%).
 * Each month compounds one twelfth of that calendar year's annual rate.
 */
export function inflationFactor(series: InflationSeries, from: string, to: string): number {
  const a = ym(from);
  const b = ym(to);
  if (a.y * 12 + a.m > b.y * 12 + b.m) return 1 / inflationFactor(series, to, from);
  let { y, m } = a;
  let factor = 1;
  while (y !== b.y || m !== b.m) {
    factor *= Math.pow(1 + rateFor(series, y) / 100, 1 / 12);
    if (++m === 13) [y, m] = [y + 1, 1];
  }
  return factor;
}

export interface GrowthPoint {
  month: string;
  value: number;
  /** The first value grown by inflation alone: what "keeping pace" would look like. */
  baseline: number | null;
}

export interface GrowthSummary {
  points: GrowthPoint[];
  /** Nominal change from first to last point, e.g. 0.25 = +25%. */
  nominal: number | null;
  /** Price rise over the same period. */
  inflation: number;
  /** Change after inflation. */
  real: number | null;
  usesEstimates: boolean;
}

/** Points must be sorted by month. */
export function growthVsInflation(series: InflationSeries, points: { month: string; value: number }[]): GrowthSummary {
  if (points.length === 0) return { points: [], nominal: null, inflation: 0, real: null, usesEstimates: false };
  const first = points[0];
  const last = points[points.length - 1];
  const comparable = first.value > 0;
  const out = points.map((p) => ({
    month: p.month,
    value: p.value,
    baseline: comparable ? first.value * inflationFactor(series, first.month, p.month) : null,
  }));
  const inflation = inflationFactor(series, first.month, last.month) - 1;
  const nominal = comparable && points.length > 1 ? last.value / first.value - 1 : null;
  return {
    points: out,
    nominal,
    inflation,
    real: nominal === null ? null : (1 + nominal) / (1 + inflation) - 1,
    usesEstimates: ym(last.month).y >= series.estimatedFrom,
  };
}
