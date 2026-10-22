# Deploying for public use

Recommended setup: **Vercel** (app) + **Neon** (Postgres). Both have free tiers that cover early users. Expect about 30–45 minutes the first time.

## 1. Database: Neon

1. Sign up at https://neon.tech and create a project (pick a US region near your users, e.g. `us-east-1`).
2. Copy the **pooled** connection string (it contains `-pooler`). This is `DATABASE_URL`.

## 2. App: Vercel

1. Sign up at https://vercel.com with your GitHub account and **Add New → Project → Import** `net-worth-tracker`.
2. Before the first deploy, add these Environment Variables (Production):

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string |
| `APP_ENCRYPTION_KEY` | run `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` and paste. **Back it up somewhere safe (e.g. a password manager). If it's lost, every stored balance becomes unreadable.** |
| `CRON_SECRET` | any long random string (same command as above) |
| `APP_URL` | your site URL, e.g. `https://net-worth-tracker.vercel.app` (update it if you add a custom domain) |

3. Deploy. The build runs database migrations automatically (`vercel-build` script), and `vercel.json` schedules the daily Plaid refresh at 09:00 UTC.
4. Optional: **Settings → Domains** to add your own domain, then update `APP_URL` and the Google redirect URI below.

## 3. Sign in with Google

1. Go to https://console.cloud.google.com, create a project (e.g. "Net Worth Tracker").
2. **APIs & Services → OAuth consent screen**: User type **External**; app name, support email, and your logo/home page/privacy policy links. Scopes: just `openid`, `email`, `profile` (these are non-sensitive, so no Google verification review is needed). Click **Publish app** so anyone can sign in (while in "Testing", only listed test users can).
3. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized JavaScript origin: `https://<your-domain>`
   - Authorized redirect URI: `https://<your-domain>/auth/google/callback` (add `http://localhost:3000/auth/google/callback` for local testing)
4. Put the client ID and secret into Vercel as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then redeploy.

If someone already has an email/password account, signing in with Google using the same (Google-verified) email links the two.

## 4. Plaid (US banks and brokerages)

1. Sign up at https://dashboard.plaid.com. Under **Developers → Keys**, copy the client ID and the **Sandbox** secret.
2. In Vercel set `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=sandbox`, redeploy, and try **Link accounts** with the test login `user_good` / `pass_good`.
3. To link real accounts, request **Production** access in the Plaid dashboard:
   - Complete the company profile and the security questionnaire (this app encrypts access tokens and balances per user, uses TLS everywhere, and never stores bank credentials).
   - Request the **Transactions** product (used for banks and cards) and **Investments** (brokerage and retirement).
   - Plaid bills these as monthly subscriptions per connected institution; check current pricing in the dashboard before going live.
   - Once approved, set `PLAID_SECRET` to the Production secret and `PLAID_ENV=production`.
4. Some large banks (Chase, Wells Fargo, Bank of America…) use OAuth in production. Register `https://<your-domain>/connections` under **Developers → API → Allowed redirect URIs** and set `PLAID_REDIRECT_URI` to that URL.

## 5. Before inviting the public

Covered by the next milestone, but worth knowing: login rate limiting, a password reset email, account deletion and data export, and a privacy policy page (Google's consent screen and Plaid's production review both ask for one).
