import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { countryForCurrency, SUPPORTED_CURRENCIES } from "@/lib/countries";
import { growthVsInflation } from "@/lib/inflation";
import { formatMoney } from "@/lib/money";
import { listSnapshots } from "@/lib/snapshots";
import { removeSnapshot } from "../actions/snapshots";
import { GrowthChart } from "./growth-chart";
import { PastSnapshotForm } from "./past-snapshot-form";

export const dynamic = "force-dynamic";

const pct = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);
const monthName = (m: string) =>
  new Date(`${m}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

export default async function HistoryPage() {
  const user = await requireUser();
  const snapshots = await listSnapshots(user);
  const currencies = user.displayCurrencies;

  return (
    <>
      <h1>History</h1>
      <p className="muted">
        A snapshot is saved each month you open the dashboard. Add earlier months below to see how your net worth has
        grown against inflation.
      </p>

      {snapshots.length < 2 && (
        <p className="warn">
          {snapshots.length === 0
            ? "No history yet. Open the dashboard after adding accounts, or add a past month below."
            : "One month recorded so far. Add an earlier month to see growth."}
        </p>
      )}

      {currencies.map((cur) => {
        const country = countryForCurrency(cur);
        const pts = snapshots.filter((s) => s.net[cur] !== undefined).map((s) => ({ month: s.month, value: s.net[cur] }));
        if (!country || pts.length === 0) return null;
        const g = growthVsInflation(country.inflation, pts);
        return (
          <section key={cur}>
            <h2>In {cur}, against {country.inflation.index}</h2>
            <div className="grid" style={{ marginBottom: 12 }}>
              <div className="card stat">
                <div className="label">Change since {monthName(pts[0].month)}</div>
                <div className="value">{pct(g.nominal)}</div>
              </div>
              <div className="card stat">
                <div className="label">Prices rose</div>
                <div className="value">{pct(g.inflation)}</div>
              </div>
              <div className="card stat">
                <div className="label">Real growth, after inflation</div>
                <div className="value">{pct(g.real)}</div>
              </div>
            </div>
            <div className="card">
              <GrowthChart points={g.points} currency={cur} inflationLabel={`${country.name} inflation`} />
            </div>
            <p className="muted small">
              {country.inflation.source}.{" "}
              {g.usesEstimates && `Figures for ${country.inflation.estimatedFrom} on are estimates.`}
            </p>
          </section>
        );
      })}

      {snapshots.length > 0 && (
        <>
          <h2>Snapshots</h2>
          <div className="card table-wrap" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  {currencies.map((c) => (
                    <th className="num" key={c}>
                      {c}
                    </th>
                  ))}
                  <th>Source</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...snapshots].reverse().map((s) => (
                  <tr key={s.id}>
                    <td>{monthName(s.month)}</td>
                    {currencies.map((c) => (
                      <td className="num" key={c}>
                        {s.net[c] === undefined ? "—" : formatMoney(s.net[c], c, { compact: true })}
                      </td>
                    ))}
                    <td className="muted small">{s.source === "auto" ? "From your accounts" : "Entered"}</td>
                    <td>
                      <form action={removeSnapshot}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="link small" aria-label={`Delete ${monthName(s.month)}`}>
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>Add a past month</h2>
      <PastSnapshotForm currencies={SUPPORTED_CURRENCIES} />
      <p className="muted small">
        Live balances live on the <Link href="/dashboard">dashboard</Link>; this month&apos;s snapshot updates whenever
        you open it, unless you entered this month yourself.
      </p>
    </>
  );
}
