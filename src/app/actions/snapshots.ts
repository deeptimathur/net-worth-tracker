"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { SUPPORTED_CURRENCIES } from "@/lib/countries";
import { getRates } from "@/lib/fx";
import { convert, type Rates } from "@/lib/money";
import { deleteSnapshot, monthOf, saveSnapshot } from "@/lib/snapshots";
import type { FormState } from "./auth";

/** "" when blank, a number when valid, NaN otherwise. */
function amount(v: FormDataEntryValue | null): number | "" {
  const s = String(v ?? "").replace(/,/g, "").trim();
  return s === "" ? "" : Number(s);
}

/** Record net worth for a past month. Values left blank are derived through the USD rate given (or today's). */
export async function addPastSnapshot(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const month = z.string().regex(/^\d{4}-\d{2}$/).safeParse(form.get("month"));
  if (!month.success) return { error: "Pick a month." };
  if (month.data > new Date().toISOString().slice(0, 7)) return { error: "That month hasn't happened yet." };

  const entered: Record<string, number> = {};
  for (const c of SUPPORTED_CURRENCIES) {
    const v = amount(form.get(`net_${c}`));
    if (Number.isNaN(v)) return { error: `The ${c} value isn't a number.` };
    if (v !== "") entered[c] = v;
  }
  if (!Object.keys(entered).length) return { error: "Enter your net worth in at least one currency." };

  // Rates for that month: what the user typed, else today's.
  const today = (await getRates()).rates;
  const rates: Rates = { USD: 1 };
  for (const c of SUPPORTED_CURRENCIES.filter((c) => c !== "USD")) {
    const typed = amount(form.get(`rate_${c}`));
    if (typed !== "" && typed > 0) rates[c] = typed;
    else if (today[c]) rates[c] = today[c];
  }
  // With two values typed and no rate, the user has told us the rate implicitly.
  if (entered.USD && entered.USD > 0) {
    for (const c of Object.keys(entered)) {
      if (c !== "USD" && amount(form.get(`rate_${c}`)) === "") rates[c] = entered[c] / entered.USD;
    }
  }

  const [given, value] = Object.entries(entered)[0];
  const net: Record<string, number> = {};
  for (const c of SUPPORTED_CURRENCIES) {
    if (c in entered) net[c] = entered[c];
    else if (rates[c] && rates[given]) net[c] = convert(value, given, c, rates);
  }
  await saveSnapshot(user, monthOf(month.data), "entered", { net, rates });
  revalidatePath("/history");
  return {};
}

export async function removeSnapshot(form: FormData): Promise<void> {
  const user = await requireUser();
  await deleteSnapshot(user, z.string().uuid().parse(form.get("id")));
  revalidatePath("/history");
}
