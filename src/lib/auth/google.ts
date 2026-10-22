import { createHash, randomBytes } from "node:crypto";

/**
 * "Sign in with Google" using the OAuth 2.0 authorization code flow with PKCE.
 * Only the openid/email/profile scopes are requested, which don't need Google's app verification.
 */
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function googleConfig(origin: string): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  // APP_URL pins the redirect in production so a spoofed Host header can't change it.
  const base = (process.env.APP_URL ?? origin).replace(/\/$/, "");
  return { clientId, clientSecret, redirectUri: `${base}/auth/google/callback` };
}

export const googleEnabled = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function newOAuthState() {
  const state = randomBytes(16).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { state, verifier, challenge };
}

export function authorizationUrl(cfg: GoogleConfig, state: string, challenge: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params}`;
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
}

/**
 * Validate the claims of an ID token received directly from Google's token endpoint over TLS
 * (OpenID Connect Core 3.1.3.7 allows skipping the signature check in that case).
 */
export function identityFromIdToken(idToken: string, clientId: string, now = Date.now()): GoogleIdentity {
  const [, payload] = idToken.split(".");
  if (!payload) throw new Error("Malformed ID token");
  const c = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  if (c.iss !== "https://accounts.google.com" && c.iss !== "accounts.google.com") throw new Error("Wrong issuer");
  if (c.aud !== clientId) throw new Error("Wrong audience");
  if (typeof c.exp !== "number" || c.exp * 1000 < now) throw new Error("Token expired");
  if (typeof c.sub !== "string" || typeof c.email !== "string") throw new Error("Missing claims");
  if (c.email_verified !== true) throw new Error("Email not verified with Google");
  return { sub: c.sub, email: c.email.toLowerCase(), name: typeof c.name === "string" ? c.name.slice(0, 80) : "" };
}

export async function exchangeCode(
  cfg: GoogleConfig,
  code: string,
  verifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleIdentity> {
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
  const body = (await res.json()) as { id_token?: string };
  if (!body.id_token) throw new Error("No ID token from Google");
  return identityFromIdToken(body.id_token, cfg.clientId);
}
