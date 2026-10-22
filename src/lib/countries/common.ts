import type { AccountType } from "./types";

export const COMMON_TYPES: Record<string, AccountType> = {
  savings: { id: "savings", label: "Savings" },
  brokerage: { id: "brokerage", label: "Brokerage / demat" },
  mutual_funds: { id: "mutual_funds", label: "Mutual funds" },
  retirement: { id: "retirement", label: "Retirement" },
  fixed_deposit: { id: "fixed_deposit", label: "Fixed / term deposit" },
  real_estate: { id: "real_estate", label: "Real estate" },
  crypto: { id: "crypto", label: "Crypto" },
  other: { id: "other", label: "Other asset" },
  loan: { id: "loan", label: "Loan", liability: true },
  credit_card: { id: "credit_card", label: "Credit card", liability: true },
};
