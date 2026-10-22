import type { AccountBase } from "plaid";
import { describe, expect, it } from "vitest";
import { accountTypeFor, mapAccounts } from "@/lib/plaid/map";

type AcctOverrides = Omit<Partial<AccountBase>, "balances"> & { balances?: Partial<AccountBase["balances"]> };
const acct = (over: AcctOverrides): AccountBase =>
  ({
    account_id: "acc1",
    name: "Plaid Checking",
    official_name: null,
    mask: "0000",
    type: "depository",
    subtype: "checking",
    ...over,
    balances: { available: null, current: 100, limit: null, iso_currency_code: "USD", unofficial_currency_code: null, ...over.balances },
  }) as AccountBase;

describe("Plaid account mapping", () => {
  it("maps types and subtypes to app account types", () => {
    const cases: [string, string, string][] = [
      ["depository", "checking", "checking"],
      ["depository", "savings", "savings"],
      ["depository", "money market", "savings"],
      ["depository", "cd", "fixed_deposit"],
      ["investment", "brokerage", "brokerage"],
      ["investment", "401k", "retirement"],
      ["investment", "roth", "retirement"],
      ["investment", "hsa", "hsa"],
      ["credit", "credit card", "credit_card"],
      ["loan", "student", "loan"],
      ["other", "other", "other"],
    ];
    for (const [type, subtype, want] of cases) {
      expect(accountTypeFor({ type, subtype } as AccountBase), `${type}/${subtype}`).toBe(want);
    }
  });

  it("keeps balances positive, labels with the mask, and skips unsupported currencies", () => {
    const { mapped, skipped } = mapAccounts([
      acct({ account_id: "a", balances: { current: 1234.5 } }),
      acct({ account_id: "b", type: "credit" as AccountBase["type"], subtype: null, name: "Card", balances: { current: -20 } }),
      acct({ account_id: "c", name: "Euro acct", balances: { iso_currency_code: "EUR" } }),
      acct({ account_id: "d", name: "No balance", balances: { current: null, available: null } }),
    ]);
    expect(mapped).toEqual([
      { externalId: "plaid:a", type: "checking", currency: "USD", balance: 1234.5, nickname: "Plaid Checking ····0000", refTail: "0000" },
      { externalId: "plaid:b", type: "credit_card", currency: "USD", balance: 20, nickname: "Card ····0000", refTail: "0000" },
    ]);
    expect(skipped).toEqual(["Euro acct", "No balance"]);
  });
});
