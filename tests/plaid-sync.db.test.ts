/**
 * Runs against a real Postgres when DATABASE_URL is set (skipped otherwise, e.g. in CI).
 * Plaid itself is mocked; no network calls are made.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

const plaid = {
  itemPublicTokenExchange: vi.fn(),
  accountsGet: vi.fn(),
  itemRemove: vi.fn(),
};
vi.mock("@/lib/plaid/client", () => ({
  getPlaid: () => plaid,
  plaidEnabled: () => true,
  plaidErrorCode: (e: { response?: { data?: { error_code?: string } } }) => e.response?.data?.error_code,
}));

const run = Boolean(process.env.DATABASE_URL);

describe.skipIf(!run)("Plaid sync (database)", () => {
  let user: import("@/lib/auth/session").SessionUser;

  beforeAll(async () => {
    process.env.APP_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");
    const { getDb, schema } = await import("@/lib/db");
    const { newWrappedDataKey } = await import("@/lib/crypto/envelope");
    const id = randomUUID();
    const wrappedDek = newWrappedDataKey(id);
    await getDb().insert(schema.users).values({ id, email: `plaid-${id}@example.com`, wrappedDek });
    user = { id, email: `plaid-${id}@example.com`, name: "", wrappedDek, displayCurrencies: ["USD", "INR"] };
  });

  const accounts = (checking: number) => ({
    data: {
      accounts: [
        { account_id: "chk", name: "Checking", mask: "1111", type: "depository", subtype: "checking", balances: { current: checking, iso_currency_code: "USD" } },
        { account_id: "cc", name: "Card", mask: "2222", type: "credit", subtype: "credit card", balances: { current: 300, iso_currency_code: "USD" } },
      ],
    },
  });

  it("links, syncs, re-syncs without duplicates, flags re-login, and disconnects", async () => {
    const { addItem, listItems, removeItem, syncItem } = await import("@/lib/plaid/items");
    const { listAccounts } = await import("@/lib/accounts");
    const { getDb, schema } = await import("@/lib/db");

    plaid.itemPublicTokenExchange.mockResolvedValue({ data: { access_token: "access-sandbox-secret", item_id: `item-${user.id}` } });
    const itemId = await addItem(user, "public-sandbox-x", "bank", "First Platypus Bank");

    // The access token is stored encrypted.
    const [row] = await getDb().select().from(schema.plaidItems).where(eq(schema.plaidItems.id, itemId));
    expect(row.data).not.toContain("access-sandbox-secret");

    plaid.accountsGet.mockResolvedValue(accounts(1000));
    expect(await syncItem(user, itemId)).toMatchObject({ created: 2, updated: 0 });
    expect(plaid.accountsGet).toHaveBeenCalledWith({ access_token: "access-sandbox-secret" });

    plaid.accountsGet.mockResolvedValue(accounts(1500));
    expect(await syncItem(user, itemId)).toMatchObject({ created: 0, updated: 2 });
    const list = await listAccounts(user);
    expect(list).toHaveLength(2);
    expect(list.find((a) => a.type === "checking")).toMatchObject({ balance: 1500, institution: "First Platypus Bank", source: "plaid" });
    expect(list.find((a) => a.type === "credit_card")?.balance).toBe(300);

    plaid.accountsGet.mockRejectedValue({ response: { data: { error_code: "ITEM_LOGIN_REQUIRED" } } });
    expect((await syncItem(user, itemId)).error).toBe("ITEM_LOGIN_REQUIRED");
    expect((await listItems(user))[0].status).toBe("login_required");

    plaid.itemRemove.mockResolvedValue({});
    await removeItem(user, itemId);
    expect(plaid.itemRemove).toHaveBeenCalled();
    expect(await listItems(user)).toEqual([]);
    expect(await listAccounts(user)).toEqual([]);
  });
});
