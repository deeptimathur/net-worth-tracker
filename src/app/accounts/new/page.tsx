import { requireUser } from "@/lib/auth/session";
import { COUNTRIES, SUPPORTED_CURRENCIES } from "@/lib/countries";
import { saveAccount } from "../../actions/accounts";
import { AccountForm } from "../account-form";

export default async function NewAccount() {
  await requireUser();
  const first = COUNTRIES[0];
  return (
    <>
      <h1>Add an account</h1>
      <AccountForm
        countries={COUNTRIES}
        currencies={SUPPORTED_CURRENCIES}
        action={saveAccount}
        initial={{
          country: first.code,
          type: first.accountTypes[0].id,
          currency: first.currency,
          institution: "",
          nickname: "",
          balance: "",
          asOf: new Date().toISOString().slice(0, 10),
        }}
      />
    </>
  );
}
