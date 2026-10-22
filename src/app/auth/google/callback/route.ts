import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, googleConfig } from "@/lib/auth/google";
import { createSession } from "@/lib/auth/session";
import { newWrappedDataKey } from "@/lib/crypto/envelope";
import { getDb, schema } from "@/lib/db";

export async function GET(req: NextRequest) {
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, req.url));
  const cfg = googleConfig(req.nextUrl.origin);
  if (!cfg) return fail("google_unavailable");

  const jar = await cookies();
  const saved = jar.get("nwt_oauth")?.value;
  jar.delete({ name: "nwt_oauth", path: "/auth/google" });
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (req.nextUrl.searchParams.get("error")) return fail("google_cancelled");
  let expected: { state?: string; verifier?: string } = {};
  try {
    expected = JSON.parse(saved ?? "{}");
  } catch {}
  if (!code || !state || !expected.verifier || state !== expected.state) return fail("google_failed");

  let identity;
  try {
    identity = await exchangeCode(cfg, code, expected.verifier);
  } catch (err) {
    console.warn("Google sign-in failed:", (err as Error).message);
    return fail("google_failed");
  }

  const db = getDb();
  const [bySub] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.googleSub, identity.sub));
  let userId = bySub?.id;
  if (!userId) {
    // Google has verified this email, so it's safe to link it to an existing password account.
    const [byEmail] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, identity.email));
    if (byEmail) {
      await db.update(schema.users).set({ googleSub: identity.sub }).where(eq(schema.users.id, byEmail.id));
      userId = byEmail.id;
    } else {
      userId = crypto.randomUUID();
      await db.insert(schema.users).values({
        id: userId,
        email: identity.email,
        name: identity.name,
        googleSub: identity.sub,
        wrappedDek: newWrappedDataKey(userId),
      });
    }
  }
  await createSession(userId);
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
