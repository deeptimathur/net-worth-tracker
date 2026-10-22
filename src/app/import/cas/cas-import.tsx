"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, useTransition } from "react";
import { applyCasImport, parseCasUpload, type CasRow } from "../../actions/cas";

interface Target {
  id: string;
  label: string;
  type: string;
}

interface EditableRow extends CasRow {
  include: boolean;
  institutionInput: string;
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

export function CasImport({ accounts }: { accounts: Target[] }) {
  const [state, uploadAction, uploading] = useActionState(parseCasUpload, undefined);
  return (
    <>
      <form
        className="stack card"
        // Submit manually so a wrong password doesn't clear the chosen file (form actions reset the form).
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => uploadAction(data));
        }}
      >
        <label>
          CAS PDF
          <input type="file" name="file" accept="application/pdf" required />
        </label>
        <label>
          PDF password <span className="muted small">(usually your PAN in capitals)</span>
          <input type="password" name="password" autoComplete="off" />
        </label>
        {state?.error && <p className="error">{state.error}</p>}
        <div className="row">
          <button disabled={uploading}>{uploading ? "Reading…" : "Read statement"}</button>
        </div>
      </form>
      {state?.statement && (
        // Remount the review whenever a new statement is read.
        <Review key={JSON.stringify(state.rows)} state={state} accounts={accounts} />
      )}
    </>
  );
}

function Review({
  state,
  accounts,
}: {
  state: Extract<Awaited<ReturnType<typeof parseCasUpload>>, { statement: object }>;
  accounts: Target[];
}) {
  const [asOf, setAsOf] = useState(state.statement.statementDate ?? "");
  const [rows, setRows] = useState<EditableRow[]>(() =>
    state.rows.map((r) => ({ ...r, include: true, institutionInput: r.institution ?? (r.kind === "mutual_funds" ? "Mutual funds" : titleCase(r.dpName)) })),
  );
  const [result, setResult] = useState<{ error?: string; updated?: number; created?: number }>();
  const [saving, startSaving] = useTransition();

  const update = (i: number, patch: Partial<EditableRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const total = rows.filter((r) => r.include).reduce((s, r) => s + r.value, 0);

  function save() {
    startSaving(async () => {
      setResult(
        await applyCasImport({
          asOf,
          rows: rows.map((r) => ({
            include: r.include,
            target: r.target,
            kind: r.kind,
            institution: r.institutionInput,
            refTail: r.refTail,
            value: r.value,
          })),
        }),
      );
    });
  }

  if (result && !result.error) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <p>
          Saved. {result.updated ? `${result.updated} account${result.updated > 1 ? "s" : ""} updated` : ""}
          {result.updated && result.created ? ", " : ""}
          {result.created ? `${result.created} added` : ""}.
        </p>
        <Link className="button" href="/dashboard">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="card stack" style={{ marginTop: 16 }}>
      <h2 style={{ margin: 0 }}>Check what we found</h2>
      {state.statement.warnings.map((w) => (
        <p className="warn" key={w}>
          {w}
        </p>
      ))}
      <label style={{ maxWidth: 220 }}>
        Values as of
        <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} required />
      </label>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Save</th>
              <th>From the statement</th>
              <th>Institution</th>
              <th>Save to</th>
              <th className="num">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const type = r.kind === "demat" ? "brokerage" : "mutual_funds";
              return (
                <tr key={i}>
                  <td>
                    <input
                      type="checkbox"
                      style={{ width: "auto" }}
                      checked={r.include}
                      onChange={(e) => update(i, { include: e.target.checked })}
                      aria-label="Include this row"
                    />
                  </td>
                  <td>
                    {r.dpName}
                    <div className="muted small">
                      {r.kind === "demat" ? `${r.depository} demat ····${r.refTail}` : "Held with the fund houses (RTAs)"}
                      {r.holdingsCount ? ` · ${r.holdingsCount} holdings` : ""}
                    </div>
                  </td>
                  <td>
                    <input
                      value={r.institutionInput}
                      onChange={(e) => update(i, { institutionInput: e.target.value })}
                      aria-label="Institution"
                      placeholder={r.kind === "mutual_funds" ? "e.g. Kuvera" : ""}
                    />
                  </td>
                  <td>
                    <select value={r.target} onChange={(e) => update(i, { target: e.target.value })} aria-label="Save to">
                      <option value="new">New account</option>
                      {accounts
                        .filter((a) => a.type === type)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="num">{inr.format(r.value)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>
                <strong>Total selected</strong>
                {state.statement.totalValue !== null && (
                  <span className="muted small"> · statement total {inr.format(state.statement.totalValue)}</span>
                )}
              </td>
              <td className="num">
                <strong>{inr.format(total)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="muted small">
        A CAS doesn't say which app you bought mutual funds through, so all folios arrive as one row. Pick the account
        you want them counted under.
      </p>
      {result?.error && <p className="error">{result.error}</p>}
      <div className="row">
        <button onClick={save} disabled={saving || !asOf || !rows.some((r) => r.include)}>
          {saving ? "Saving…" : "Save these values"}
        </button>
      </div>
    </div>
  );
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
