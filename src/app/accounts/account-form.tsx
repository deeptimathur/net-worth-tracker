"use client";

import { useActionState, useState } from "react";
import type { CountryModule } from "@/lib/countries";
import type { FormState } from "../actions/auth";

export interface AccountFormValues {
  id?: string;
  country: string;
  type: string;
  currency: string;
  institution: string;
  nickname: string;
  balance: number | "";
  asOf: string;
  notes?: string;
}

export function AccountForm({
  countries,
  currencies,
  initial,
  action,
}: {
  countries: CountryModule[];
  currencies: string[];
  initial: AccountFormValues;
  action: (state: FormState, form: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [countryCode, setCountryCode] = useState(initial.country);
  const country = countries.find((c) => c.code === countryCode) ?? countries[0];
  const [currency, setCurrency] = useState(initial.currency || country.currency);

  return (
    <form action={formAction} className="stack card">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid">
        <label>
          Country
          <select
            name="country"
            value={countryCode}
            onChange={(e) => {
              setCountryCode(e.target.value);
              const next = countries.find((c) => c.code === e.target.value);
              if (next) setCurrency(next.currency);
            }}
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select name="type" defaultValue={initial.type} key={country.code}>
            {country.accountTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Bank or broker
        <input name="institution" defaultValue={initial.institution} list={`inst-${country.code}`} required />
        <datalist id={`inst-${country.code}`}>
          {country.institutions.map((i) => (
            <option key={i.name} value={i.name} />
          ))}
        </datalist>
      </label>
      <label>
        Nickname <span className="muted small">(optional, e.g. "Joint savings")</span>
        <input name="nickname" defaultValue={initial.nickname} />
      </label>
      <div className="grid">
        <label>
          Balance
          <input name="balance" inputMode="decimal" defaultValue={initial.balance} required placeholder="0.00" />
        </label>
        <label>
          Currency
          <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          As of
          <input name="asOf" type="date" defaultValue={initial.asOf} required />
        </label>
      </div>
      <label>
        Notes <span className="muted small">(optional)</span>
        <textarea name="notes" rows={2} defaultValue={initial.notes} />
      </label>
      <p className="muted small">For loans and credit cards, enter what you owe as a positive number.</p>
      {state?.error && <p className="error">{state.error}</p>}
      <div className="row">
        <button disabled={pending}>{initial.id ? "Save changes" : "Add account"}</button>
      </div>
    </form>
  );
}
