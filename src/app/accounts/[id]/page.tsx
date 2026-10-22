import { notFound } from "next/navigation";
import { z } from "zod";
import { getAccount } from "@/lib/accounts";
import { requireUser } from "@/lib/auth/session";
import { COUNTRIES, SUPPORTED_CURRENCIES } from "@/lib/countries";
import { removeAccount, saveAccount } from "../../actions/accounts";
import { AccountForm } from "../account-form";

export default async function EditAccount({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = z.string().uuid().safeParse((await params).id);
  const account = id.success ? await getAccount(user, id.data) : undefined;
  if (!account) notFound();
  return (
    <>
      <h1>{account.institution}</h1>
      {account.source !== "manual" && (
        <p className="muted small">Last updated from a {account.source.toUpperCase()} import. The next import will update it again.</p>
      )}
      <AccountForm
        countries={COUNTRIES}
        currencies={SUPPORTED_CURRENCIES}
        action={saveAccount}
        initial={{ ...account, asOf: account.asOf ?? new Date().toISOString().slice(0, 10) }}
      />
      <form action={removeAccount} style={{ marginTop: 16 }}>
        <input type="hidden" name="id" value={account.id} />
        <button className="danger">Delete this account</button>
      </form>
    </>
  );
}
