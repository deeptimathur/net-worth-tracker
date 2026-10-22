import Link from "next/link";
import { listAccounts } from "@/lib/accounts";
import { requireUser } from "@/lib/auth/session";
import { COUNTRIES, getAccountType, getCountry, isLiability } from "@/lib/countries";
import { getRates } from "@/lib/fx";
import { computeTotals, convert, formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requireUser();
  const [accounts, fx] = await Promise.all([listAccounts(user), getRates()]);
  const currencies = user.displayCurrencies.filter((c) => fx.rates[c]);
  const primary = currencies[0] ?? "USD";
  const totals = computeTotals(accounts, currencies.length ? currencies : ["USD"], fx.rates);
  const grossAssets = totals.assets[primary] || 1;

  return (
    <>
      <h1>{user.name ? `${user.name}'s net worth` : "Net worth"}</h1>
      <p className="muted small">
        {fx.day ? (
          <>
            Exchange rates from {fx.source}, {fx.day}
            {currencies.includes("INR") && ` · 1 USD = ${formatMoney(fx.rates.INR, "INR")}`}
          </>
        ) : (
          "Exchange rates aren't available yet, so only USD accounts are counted."
        )}
      </p>
      {fx.stale && fx.day && <p className="warn">Exchange rates are more than a few days old.</p>}
      {totals.unconverted.length > 0 && (
        <p className="warn">
          Accounts in {totals.unconverted.join(", ")} are left out of the totals until an exchange rate is available.
        </p>
      )}

      <div className="grid">
        {currencies.map((c) => (
          <div className="card stat" key={c}>
            <div className="label">Net worth in {c}</div>
            <div className="value">{formatMoney(totals.net[c], c, { compact: true })}</div>
            {totals.liabilities[c] > 0 && (
              <div className="muted small">
                {formatMoney(totals.assets[c], c, { compact: true })} assets − {formatMoney(totals.liabilities[c], c, { compact: true })} owed
              </div>
            )}
          </div>
        ))}
      </div>

      {accounts.length === 0 ? (
        <div className="card" style={{ marginTop: 24 }}>
          <h2 style={{ marginTop: 0 }}>Add your first account</h2>
          <p className="muted">Start with a bank or brokerage balance, or import your Indian holdings from a CAS statement.</p>
          <div className="row">
            <Link className="button" href="/accounts/new">
              Add an account
            </Link>
            <Link className="button secondary" href="/import/cas">
              Import a CAS PDF
            </Link>
          </div>
        </div>
      ) : (
        <>
          <h2>By country</h2>
          <div className="grid">
            {COUNTRIES.filter((c) => totals.byCountry[c.code] !== undefined).map((c) => (
              <div className="card stat" key={c.code}>
                <div className="label">{c.name}</div>
                <div className="value" style={{ fontSize: "1.2rem" }}>
                  {formatMoney(totals.byCountry[c.code], primary, { compact: true })}
                </div>
                <div className="bar" aria-hidden>
                  <span style={{ width: `${Math.max(0, (totals.byCountry[c.code] / grossAssets) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <h2>Accounts</h2>
          <div className="card table-wrap" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Type</th>
                  <th className="num">Balance</th>
                  <th className="num">In {primary}</th>
                  <th>As of</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => {
                  const sign = isLiability(a.country, a.type) ? -1 : 1;
                  const converted = fx.rates[a.currency] ? sign * convert(a.balance, a.currency, primary, fx.rates) : null;
                  return (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/accounts/${a.id}`}>{a.institution}</Link>
                        {a.nickname && <div className="muted small">{a.nickname}</div>}
                      </td>
                      <td>
                        {getAccountType(a.country, a.type)?.label ?? a.type}{" "}
                        <span className="pill">{getCountry(a.country)?.code ?? a.country}</span>
                        {a.source !== "manual" && <span className="pill">{a.source.toUpperCase()}</span>}
                      </td>
                      <td className="num">{formatMoney(sign * a.balance, a.currency)}</td>
                      <td className="num">{converted === null ? "—" : formatMoney(converted, primary, { compact: true })}</td>
                      <td className="muted small">{a.asOf ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
