# Plan

Goal: a hosted app anyone can sign up for to see their net worth across countries. India and the USA first, built so other countries are a plug-in.

## Architecture

- **Next.js (App Router, TypeScript)** for pages and server actions. One deployable, no separate API.
- **Postgres** via Drizzle ORM. Plain SQL migrations in `drizzle/`, so any Postgres host works (Neon, Supabase, RDS, local).
- **Hosting:** Vercel + Neon (chosen 2026-10-22). Migrations run on each Vercel build. See `docs/DEPLOY.md`.
- **Countries** live in `src/lib/countries/`. Each module declares its currency, account types (and which are liabilities), known institutions, inflation index and importers. Adding a country = one file + one line in the registry.
- **FX:** shared daily ECB reference rates from Frankfurter (free, keyless, includes INR), cached in `fx_rates` so the API is hit about once a day for all users. Alpha Vantage can be swapped in through `FX_API_URL`/`fetchRates`.

## Security model

- Passwords: scrypt with per-user salt; sessions are random 256-bit tokens in an httpOnly cookie, stored only as SHA-256 hashes.
- Financial data: envelope encryption. Each user has a random data key, wrapped with the app master key (`APP_ENCRYPTION_KEY`). Institution, nickname, balance and notes are AES-256-GCM encrypted with an AAD binding them to the owner. A database leak alone reveals only country, account type, currency and dates.
- Every query is scoped by `user_id`; ids from forms are validated as UUIDs.
- CAS import: PDF and password are processed in memory, never stored or logged. The user reviews parsed values before anything is saved.
- Headers: frame-deny, nosniff, same-origin referrer. Next.js server actions check the request origin (CSRF).

Before a public launch: login rate limiting, email verification and password reset (needs an email provider, e.g. Resend), account deletion/export, a privacy policy, and master-key rotation tooling.

## Milestones

1. **MVP (done, #1):** signup/login, manual accounts for US and India, totals in USD and INR with daily FX, by-country breakdown, CDSL/NSDL CAS upload with review.
2. **History (done):** a monthly snapshot saved from live balances, past months entered by hand, and a growth chart per display currency against that country's CPI (US CPI-U, India CPI Combined; recent years flagged as estimates in the country modules). Still to do: user-chosen display currencies.
3. **Hardening for public use:** rate limiting, email verification, password reset, Google sign-in, data export and account deletion, audit log.
4. **US linking (Plaid) + Google sign-in (done):** Plaid Link for banks/cards (Transactions) and brokerages (Investments); balances from `/accounts/get` (no per-call fee) on link, on demand, and by daily cron; re-login via Link update mode. Access tokens encrypted with the user's data key. Google sign-in via OAuth code flow with PKCE. Production Plaid needs approval and is billed per connected institution per month. Still to do: Plaid webhooks, holdings detail.
5. **India linking (Account Aggregator):** consent-based bank and investment data via RBI's AA framework. Needs either our own FIU registration (regulated entity) or a partner TSP such as Setu, Finvu or OneMoney. Until then: CAS for demat/MF, bank statement PDF import, manual entry.
6. **More countries:** add a module (e.g. UK/GBP, UAE/AED). FX already covers ECB currencies.

## Open decisions

- Business model: aggregator fees (Plaid per account, AA per fetch) mean linked accounts probably need a paid tier.
