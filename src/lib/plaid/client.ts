import "server-only";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const globalForPlaid = globalThis as unknown as { __nwtPlaid?: PlaidApi };

export const plaidEnabled = () => Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);

export function plaidEnv(): "sandbox" | "production" {
  return process.env.PLAID_ENV === "production" ? "production" : "sandbox";
}

export function getPlaid(): PlaidApi {
  if (!plaidEnabled()) throw new Error("Plaid is not configured");
  globalForPlaid.__nwtPlaid ??= new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[plaidEnv()],
      baseOptions: {
        headers: { "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!, "PLAID-SECRET": process.env.PLAID_SECRET! },
        timeout: 15000,
      },
    }),
  );
  return globalForPlaid.__nwtPlaid;
}

/** Plaid's error code from an axios error, if any. */
export function plaidErrorCode(err: unknown): string | undefined {
  return (err as { response?: { data?: { error_code?: string } } }).response?.data?.error_code;
}
