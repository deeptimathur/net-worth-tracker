import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { plaidEnabled } from "@/lib/plaid/client";
import { syncAllItems } from "@/lib/plaid/items";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Daily balance refresh. Vercel Cron sends "Authorization: Bearer $CRON_SECRET". */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!plaidEnabled()) return NextResponse.json({ skipped: "plaid not configured" });
  return NextResponse.json(await syncAllItems());
}
