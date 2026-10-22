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
  inflationIndex: "US CPI-U",
  importers: [],
};
