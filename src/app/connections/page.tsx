import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { plaidEnabled, plaidEnv } from "@/lib/plaid/client";
import { listItems } from "@/lib/plaid/items";
import { disconnect, refreshConnection } from "../actions/plaid";
import { ConnectButton } from "./plaid-link";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const user = await requireUser();
  if (!plaidEnabled()) {
    return (
      <>
        <h1>Linked accounts</h1>
        <p className="warn">Automatic US account linking isn&apos;t set up on this server yet.</p>
        <p className="muted">
          You can still <Link href="/accounts/new">add accounts by hand</Link>.
        </p>
      </>
    );
  }
  const items = await listItems(user);
  return (
    <>
      <h1>Linked accounts</h1>
      <p className="muted">
        Connect US banks, cards and brokerages through Plaid. Balances refresh automatically once a day, and you can
        refresh any time. We only read balances; we never see your bank password and can&apos;t move money.
      </p>
      {plaidEnv() === "sandbox" && (
        <p className="warn small">
          Test mode: pick any bank and sign in with username <code>user_good</code> and password <code>pass_good</code>.
        </p>
      )}
      <div className="row" style={{ alignItems: "flex-start", margin: "16px 0" }}>
        <ConnectButton kind="bank" label="Connect a bank or card" />
        <ConnectButton kind="investments" label="Connect a brokerage or retirement account" className="secondary" />
      </div>

      {items.length > 0 && (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Institution</th>
                <th>Status</th>
                <th>Last refreshed</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>
                    {i.institutionName}
                    <div className="muted small">{i.kind === "bank" ? "Bank / card" : "Investments"}</div>
                  </td>
                  <td>
                    {i.status === "ok" ? (
                      "Connected"
                    ) : i.status === "login_required" ? (
                      <>
                        <span className="error">Sign-in needed</span>
                        <ConnectButton kind={i.kind} itemId={i.id} label="Reconnect" className="secondary" />
                      </>
                    ) : (
                      <span className="error" title={i.lastError ?? undefined}>
                        Couldn&apos;t refresh
                      </span>
                    )}
                  </td>
                  <td className="muted small">{i.lastSyncedAt ? i.lastSyncedAt.toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—"}</td>
                  <td>
                    <div className="row">
                      <form action={refreshConnection}>
                        <input type="hidden" name="id" value={i.id} />
                        <button className="secondary">Refresh</button>
                      </form>
                      <form action={disconnect}>
                        <input type="hidden" name="id" value={i.id} />
                        <button className="danger">Disconnect</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">Disconnecting removes the institution&apos;s accounts from your tracker.</p>
    </>
  );
}
