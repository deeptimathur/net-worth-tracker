"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAccount, deleteAccount, getAccount, updateAccount, type AccountInput } from "@/lib/accounts";
import { requireUser } from "@/lib/auth/session";
import { getAccountType, SUPPORTED_CURRENCIES } from "@/lib/countries";
import type { FormState } from "./auth";

const accountSchema = z
  .object({
    country: z.string(),
    type: z.string(),
    currency: z.enum(SUPPORTED_CURRENCIES as [string, ...string[]]),
    institution: z.string().trim().min(1, "Enter the bank or broker.").max(80),
    nickname: z.string().trim().max(80),
    balance: z.coerce.number().finite().min(0, "Enter the balance as a positive number; loans and cards are subtracted automatically."),
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date of this balance."),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((a) => getAccountType(a.country, a.type), { message: "Pick an account type for that country." });

function parseAccount(form: FormData) {
  return accountSchema.safeParse({
    country: form.get("country"),
    type: form.get("type"),
    currency: form.get("currency"),
    institution: form.get("institution"),
    nickname: form.get("nickname") ?? "",
    balance: String(form.get("balance") ?? "").replace(/,/g, ""),
    asOf: form.get("asOf"),
    notes: form.get("notes") || undefined,
  });
}

export async function saveAccount(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parseAccount(form);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input: AccountInput = { ...parsed.data, source: "manual" };
  const id = z.string().uuid().safeParse(form.get("id"));
  if (id.success) {
    const existing = await getAccount(user, id.data);
    if (!existing) return { error: "That account no longer exists." };
    // Keep the import link so the next statement still updates this account.
    await updateAccount(user, id.data, { ...input, refTail: existing.refTail, source: existing.source });
  } else {
    await createAccount(user, input);
  }
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function removeAccount(form: FormData): Promise<void> {
  const user = await requireUser();
  const id = z.string().uuid().parse(form.get("id"));
  await deleteAccount(user, id);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
