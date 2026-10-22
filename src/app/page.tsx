import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { COUNTRIES } from "@/lib/countries";

export default async function Home() {
  if (await getCurrentUser().catch(() => null)) redirect("/dashboard");
  return (
    <div className="narrow" style={{ maxWidth: 620 }}>
      <h1>Your net worth, across countries</h1>
      <p className="muted">
        Track bank, brokerage and mutual fund accounts in {COUNTRIES.map((c) => c.name).join(" and ")}, and see the
        total in every currency you care about with daily exchange rates.
      </p>
      <ul>
        <li>Link US banks, cards and brokerages securely through Plaid.</li>
        <li>Import Indian demat and mutual fund holdings from your CDSL / NSDL CAS statement, or add accounts by hand.</li>
        <li>Balances are encrypted with a key unique to you before they're stored.</li>
        <li>Statement PDFs and their passwords are read in memory and never saved.</li>
      </ul>
      <div className="row">
        <Link className="button" href="/signup">
          Create an account
        </Link>
        <Link className="button secondary" href="/login">
          Log in
        </Link>
      </div>
    </div>
  );
}
