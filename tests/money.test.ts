import { describe, expect, it } from "vitest";
import { COUNTRIES, getCountry, isLiability, matchInstitution } from "@/lib/countries";
import { computeTotals, convert, formatMoney, parseAmount } from "@/lib/money";

const rates = { USD: 1, INR: 80 };

describe("money", () => {
  it("converts through USD", () => {
    expect(convert(8000, "INR", "USD", rates)).toBe(100);
    expect(convert(100, "USD", "INR", rates)).toBe(8000);
    expect(() => convert(1, "EUR", "USD", rates)).toThrow(/EUR/);
  });

  it("totals assets minus liabilities in every display currency", () => {
    const t = computeTotals(
      [
        { country: "US", type: "checking", currency: "USD", balance: 1000 },
        { country: "IN", type: "savings", currency: "INR", balance: 80000 },
        { country: "US", type: "credit_card", currency: "USD", balance: 200 },
        { country: "IN", type: "other", currency: "EUR", balance: 5 },
      ],
      ["USD", "INR"],
      rates,
    );
    expect(t.net).toEqual({ USD: 1800, INR: 144000 });
    expect(t.assets.USD).toBe(2000);
    expect(t.liabilities.USD).toBe(200);
    expect(t.byCountry).toEqual({ US: 800, IN: 1000 });
    expect(t.unconverted).toEqual(["EUR"]);
  });

  it("formats INR with lakh grouping and parses statement amounts", () => {
    expect(formatMoney(639144.64, "INR")).toBe("₹6,39,144.64");
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
    expect(parseAmount("₹ 6,39,144.64")).toBe(639144.64);
    expect(parseAmount("abc")).toBeNaN();
  });
});

describe("country registry", () => {
  it("every country has unique account types and a currency", () => {
    for (const c of COUNTRIES) {
      expect(c.currency).toMatch(/^[A-Z]{3}$/);
      const ids = c.accountTypes.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("knows liabilities and institutions", () => {
    expect(isLiability("IN", "loan")).toBe(true);
    expect(isLiability("US", "brokerage")).toBe(false);
    expect(matchInstitution("IN", "GROWW INVEST TECH PRIVATE LIMITED")).toBe("Groww");
    expect(getCountry("XX")).toBeUndefined();
  });
});
