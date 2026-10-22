import { describe, expect, it } from "vitest";
import { COUNTRIES, countryForCurrency, type InflationSeries } from "@/lib/countries";
import { growthVsInflation, inflationFactor } from "@/lib/inflation";

const flat: InflationSeries = { index: "T", source: "test", annual: { 2020: 12, 2021: 0 }, estimatedFrom: 2021 };

describe("inflationFactor", () => {
  it("compounds a twelfth of the year's rate per month", () => {
    expect(inflationFactor(flat, "2020-01-01", "2021-01-01")).toBeCloseTo(1.12, 10);
    expect(inflationFactor(flat, "2020-01-01", "2020-07-01")).toBeCloseTo(Math.sqrt(1.12), 10);
    expect(inflationFactor(flat, "2021-01-01", "2021-12-01")).toBe(1);
  });

  it("is 1 for the same month and inverts when reversed", () => {
    expect(inflationFactor(flat, "2020-05-01", "2020-05-01")).toBe(1);
    expect(inflationFactor(flat, "2021-01-01", "2020-01-01")).toBeCloseTo(1 / 1.12, 10);
  });

  it("carries the nearest known year outside the table", () => {
    expect(inflationFactor(flat, "2019-01-01", "2020-01-01")).toBeCloseTo(1.12, 10);
    expect(inflationFactor(flat, "2030-01-01", "2031-01-01")).toBe(1);
  });
});

describe("growthVsInflation", () => {
  it("reports nominal, inflation and real growth", () => {
    const g = growthVsInflation(flat, [
      { month: "2020-01-01", value: 100 },
      { month: "2021-01-01", value: 134.4 },
    ]);
    expect(g.nominal).toBeCloseTo(0.344, 10);
    expect(g.inflation).toBeCloseTo(0.12, 10);
    expect(g.real).toBeCloseTo(0.2, 10);
    expect(g.points[1].baseline).toBeCloseTo(112, 8);
    expect(g.usesEstimates).toBe(true);
  });

  it("skips the comparison when the starting value isn't positive", () => {
    const g = growthVsInflation(flat, [
      { month: "2020-01-01", value: -5 },
      { month: "2020-06-01", value: 10 },
    ]);
    expect(g.nominal).toBeNull();
    expect(g.real).toBeNull();
    expect(g.points.every((p) => p.baseline === null)).toBe(true);
  });

  it("handles a single point and no points", () => {
    expect(growthVsInflation(flat, [{ month: "2020-01-01", value: 1 }]).nominal).toBeNull();
    expect(growthVsInflation(flat, []).points).toEqual([]);
  });
});

describe("country inflation data", () => {
  it("covers every country with sane yearly figures", () => {
    for (const c of COUNTRIES) {
      const years = Object.keys(c.inflation.annual).map(Number);
      expect(years.length).toBeGreaterThan(5);
      for (const y of years) expect(Math.abs(c.inflation.annual[y])).toBeLessThan(30);
    }
    expect(countryForCurrency("INR")?.code).toBe("IN");
    expect(countryForCurrency("USD")?.code).toBe("US");
  });
});
