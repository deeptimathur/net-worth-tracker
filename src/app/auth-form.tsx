"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "./actions/auth";

export function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "signup";
  action: (state: FormState, form: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const signup = mode === "signup";
  return (
    <div className="card narrow">
      <h1>{signup ? "Create your account" : "Log in"}</h1>
      <form action={formAction} className="stack">
        {signup && (
          <label>
            Name
            <input name="name" autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={10}
            autoComplete={signup ? "new-password" : "current-password"}
          />
        </label>
        {state?.error && <p className="error">{state.error}</p>}
        <button disabled={pending}>{signup ? "Sign up" : "Log in"}</button>
      </form>
      <p className="muted small">
        {signup ? (
          <>
            Already have an account? <Link href="/login">Log in</Link>
          </>
        ) : (
          <>
            New here? <Link href="/signup">Create an account</Link>
          </>
        )}
      </p>
    </div>
  );
}
