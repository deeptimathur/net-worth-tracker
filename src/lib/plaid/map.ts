import type { AccountBase } from "plaid";
import { SUPPORTED_CURRENCIES } from "../countries";

const RETIREMENT = new Set([
  "401a", "401k", "403b", "457b", "ira", "roth", "roth 401k", "sep ira", "simple ira", "sarsep",
  "keogh", "pension", "profit sharing plan", "retirement", "thrift savings plan", "non-taxable brokerage account",
]);

/** Map a Plaid account to this app's US account type. */
export function accountTypeFor(a: Pick<AccountBase, "type" | "subtype">): string {
  const sub = (a.subtype ?? "").toString().toLowerCase();
  switch (a.type) {
    case "depository":
      if (sub === "savings" || sub === "money market") return "savings";
      if (sub === "cd") return "fixed_deposit";
      if (sub === "hsa") return "hsa";
      return "checking";
    case "investment":
      if (sub === "hsa") return "hsa";
      if (sub === "crypto exchange") return "crypto";
      if (RETIREMENT.has(sub) || sub.includes("ira") || sub.includes("401")) return "retirement";
      return "brokerage";
    case "credit":
      return "credit_card";
    case "loan":
      return "loan";
    default:
      return "other";
  }
}

export interface MappedAccount {
  externalId: string;
  type: string;
  currency: string;
  balance: number;
  nickname: string;
  refTail?: string;
}

/**
 * Turn Plaid accounts into balances. `current` is the total value for investments and the amount
 * owed for credit and loans, which matches how this app stores liabilities (positive, subtracted by type).
 * Accounts in a currency the app doesn't support yet, or without a balance, are returned in `skipped`.
 */
export function mapAccounts(accounts: AccountBase[]): { mapped: MappedAccount[]; skipped: string[] } {
  const mapped: MappedAccount[] = [];
  const skipped: string[] = [];
  for (const a of accounts) {
    const currency = a.balances.iso_currency_code ?? "";
    const balance = a.balances.current ?? a.balances.available;
    const label = a.official_name || a.name;
    if (!SUPPORTED_CURRENCIES.includes(currency) || balance === null || balance === undefined) {
      skipped.push(label);
      continue;
    }
    mapped.push({
      externalId: `plaid:${a.account_id}`,
      type: accountTypeFor(a),
      currency,
      // A credit balance below zero is money owed to the user; keep stored balances positive.
      balance: Math.abs(balance),
      nickname: a.mask ? `${a.name} ····${a.mask}` : a.name,
      refTail: a.mask ?? undefined,
    });
  }
  return { mapped, skipped };
}
