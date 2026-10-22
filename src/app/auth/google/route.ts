import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { authorizationUrl, googleConfig, newOAuthState } from "@/lib/auth/google";

export async function GET(req: NextRequest) {
  const cfg = googleConfig(req.nextUrl.origin);
  if (!cfg) return NextResponse.redirect(new URL("/login?error=google_unavailable", req.url));
  const { state, verifier, challenge } = newOAuthState();
  (await cookies()).set("nwt_oauth", JSON.stringify({ state, verifier }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/auth/google",
    maxAge: 600,
  });
  return NextResponse.redirect(authorizationUrl(cfg, state, challenge));
}
