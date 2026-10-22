import { COMMON_TYPES as T } from "./common";
import type { CountryModule } from "./types";

export const US: CountryModule = {
  code: "US",
  name: "United States",
  currency: "USD",
  locale: "en-US",
  accountTypes: [
    { id: "checking", label: "Checking" },
    T.savings,
    T.brokerage,
    { id: "retirement", label: "Retirement (401k / IRA)" },
    { id: "hsa", label: "HSA" },
    { id: "fixed_deposit", label: "CD" },
    T.real_estate,
    T.crypto,
    T.other,
    T.loan,
    T.credit_card,
  ],
  institutions: [
    { name: "Chase", match: ["CHASE", "JPMORGAN"] },
    { name: "Bank of America", match: ["BANK OF AMERICA"] },
    { name: "Wells Fargo", match: ["WELLS FARGO"] },
    { name: "PNC", match: ["PNC"] },
    { name: "Fidelity", match: ["FIDELITY"] },
    { name: "Charles Schwab", match: ["SCHWAB"] },
    { name: "Vanguard", match: ["VANGUARD"] },
    { name: "Robinhood", match: ["ROBINHOOD"] },
  ],
  inflation: {
    index: "US CPI-U",
    source: "U.S. Bureau of Labor Statistics, CPI-U annual average",
    annual: {
      2010: 1.6, 2011: 3.2, 2012: 2.1, 2013: 1.5, 2014: 1.6, 2015: 0.1, 2016: 1.3, 2017: 2.1,
      2018: 2.4, 2019: 1.8, 2020: 1.2, 2021: 4.7, 2022: 8.0, 2023: 4.1, 2024: 2.9, 2025: 2.7, 2026: 2.8,
    },
    estimatedFrom: 2025,
  },
  importers: [],
};
