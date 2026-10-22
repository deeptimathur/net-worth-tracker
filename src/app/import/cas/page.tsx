import { listAccounts } from "@/lib/accounts";
import { requireUser } from "@/lib/auth/session";
import { getAccountType } from "@/lib/countries";
import { CasImport } from "./cas-import";

export default async function CasImportPage() {
  const user = await requireUser();
  const accounts = (await listAccounts(user))
    .filter((a) => a.country === "IN" && (a.type === "brokerage" || a.type === "mutual_funds"))
    .map((a) => ({
      id: a.id,
      label: `${a.institution}${a.nickname ? ` · ${a.nickname}` : ""} (${getAccountType("IN", a.type)?.label})`,
      type: a.type,
    }));
  return (
    <>
      <h1>Import a CAS statement</h1>
      <p className="muted">
        Upload the monthly Consolidated Account Statement that CDSL or NSDL emails you. We read the summary of each
        demat account and your mutual fund folios, show you what we found, and only save once you confirm.
      </p>
      <p className="muted small">
        The PDF and its password are processed in memory and are not stored. Only the values you confirm are saved,
        encrypted.
      </p>
      <CasImport accounts={accounts} />
    </>
  );
}
