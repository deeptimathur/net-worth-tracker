import { describe, expect, it } from "vitest";
import { authorizationUrl, identityFromIdToken, newOAuthState } from "@/lib/auth/google";

const cfg = { clientId: "cid.apps.googleusercontent.com", clientSecret: "s", redirectUri: "https://app.example/auth/google/callback" };
const token = (claims: Record<string, unknown>) =>
  ["e30", Buffer.from(JSON.stringify(claims)).toString("base64url"), "sig"].join(".");
const good = {
  iss: "https://accounts.google.com",
  aud: cfg.clientId,
  exp: Math.floor(Date.now() / 1000) + 600,
  sub: "1234567890",
  email: "Someone@Example.com",
  email_verified: true,
  name: "Some One",
};

describe("Google sign-in", () => {
  it("builds a PKCE authorization URL", () => {
    const { state, challenge, verifier } = newOAuthState();
    expect(verifier).not.toBe(challenge);
    const url = new URL(authorizationUrl(cfg, state, challenge));
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe(state);
    expect(url.searchParams.get("redirect_uri")).toBe(cfg.redirectUri);
  });

  it("accepts a valid ID token and lower-cases the email", () => {
    expect(identityFromIdToken(token(good), cfg.clientId)).toEqual({ sub: "1234567890", email: "someone@example.com", name: "Some One" });
  });

  it.each([
    ["wrong audience", { aud: "other" }],
    ["wrong issuer", { iss: "https://evil.example" }],
    ["expired", { exp: 1 }],
    ["unverified email", { email_verified: false }],
    ["missing sub", { sub: undefined }],
  ])("rejects %s", (_, patch) => {
    expect(() => identityFromIdToken(token({ ...good, ...patch }), cfg.clientId)).toThrow();
  });
});
