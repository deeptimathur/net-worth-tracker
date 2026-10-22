"use client";

import { useActionState } from "react";
import { addPastSnapshot } from "../actions/snapshots";

export function PastSnapshotForm({ currencies }: { currencies: string[] }) {
  const [state, action, pending] = useActionState(addPastSnapshot, undefined);
  const others = currencies.filter((c) => c !== "USD");
  return (
    <form action={action} className="card stack">
      <div className="grid">
        <label>
          Month
          <input type="month" name="month" required max={new Date().toISOString().slice(0, 7)} />
        </label>
        {currencies.map((c) => (
          <label key={c}>
            Net worth in {c}
            <input name={`net_${c}`} inputMode="decimal" placeholder="optional" />
          </label>
        ))}
      </div>
      {others.length > 0 && (
        <details>
          <summary className="small muted">Exchange rate that month (optional)</summary>
          <div className="grid" style={{ marginTop: 8 }}>
            {others.map((c) => (
              <label key={c}>
                1 USD in {c}
                <input name={`rate_${c}`} inputMode="decimal" placeholder="today's rate if blank" />
              </label>
            ))}
          </div>
        </details>
      )}
      <p className="muted small">Fill in one currency or more. Blank ones are worked out from the exchange rate.</p>
      {state?.error && <p className="error">{state.error}</p>}
      {state && !state.error && <p className="small">Saved.</p>}
      <div className="row">
        <button disabled={pending}>Save month</button>
      </div>
    </form>
  );
}
