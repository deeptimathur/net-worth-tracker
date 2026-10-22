"use server";

import { revalidatePath } from "next/cache";
import { CountryCode, Products } from "plaid";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { getPlaid, plaidEnabled, plaidErrorCode } from "@/lib/plaid/client";
import { addItem, getAccessToken, removeItem, syncItem, type LinkKind, type SyncResult } from "@/lib/plaid/items";

const kindSchema = z.enum(["bank", "investments"]);

/**
 * Link token for a new connection, or for update mode (re-login) when itemId is given.
 * Banks link with Transactions (covers checking, savings and credit cards); brokerages with Investments.
 */
export async function createLinkToken(kind: LinkKind, itemId?: string): Promise<{ token?: string; error?: string }> {
  const user = await requireUser();
  if (!plaidEnabled()) return { error: "Account linking isn't set up on this server yet." };
  const parsedKind = kindSchema.parse(kind);
  const accessToken = itemId ? await getAccessToken(user, z.string().uuid().parse(itemId)) : undefined;
  if (itemId && !accessToken) return { error: "Connection not found." };
  try {
    const { data } = await getPlaid().linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: "Net Worth Tracker",
      language: "en",
      country_codes: [CountryCode.Us],
      ...(accessToken
        ? { access_token: accessToken }
        : { products: [parsedKind === "bank" ? Products.Transactions : Products.Investments] }),
      ...(process.env.PLAID_REDIRECT_URI ? { redirect_uri: process.env.PLAID_REDIRECT_URI } : {}),
    });
    return { token: data.link_token };
  } catch (err) {
    console.error("linkTokenCreate failed", plaidErrorCode(err) ?? (err as Error).message);
    return { error: "Couldn't start account linking. Please try again." };
  }
}

/** Called by Plaid Link on success: store the connection and pull balances right away. */
export async function completeLink(
  publicToken: string,
  kind: LinkKind,
  institutionName: string,
): Promise<SyncResult & { error?: string }> {
  const user = await requireUser();
  try {
    const token = z.string().min(1).max(200).parse(publicToken);
    const name = z.string().trim().min(1).max(80).catch("Linked institution").parse(institutionName);
    const id = await addItem(user, token, kindSchema.parse(kind), name);
    const res = await syncItem(user, id);
    revalidatePath("/dashboard");
    revalidatePath("/connections");
    return res;
  } catch (err) {
    console.error("Plaid link failed", plaidErrorCode(err) ?? (err as Error).message);
    return { updated: 0, created: 0, skipped: [], error: "Linking failed. Please try again." };
  }
}

export async function refreshConnection(form: FormData): Promise<void> {
  const user = await requireUser();
  await syncItem(user, z.string().uuid().parse(form.get("id")));
  revalidatePath("/connections");
  revalidatePath("/dashboard");
}

/** After a successful update-mode Link session, re-sync the item. */
export async function afterReconnect(itemId: string): Promise<void> {
  const user = await requireUser();
  await syncItem(user, z.string().uuid().parse(itemId));
  revalidatePath("/connections");
  revalidatePath("/dashboard");
}

export async function disconnect(form: FormData): Promise<void> {
  const user = await requireUser();
  await removeItem(user, z.string().uuid().parse(form.get("id")));
  revalidatePath("/connections");
  revalidatePath("/dashboard");
}
