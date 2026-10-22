"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAccount, getAccount, listAccounts, updateAccount } from "@/lib/accounts";
import { requireUser } from "@/lib/auth/session";
import { getAccountType } from "@/lib/countries";
import { extractPdfLines, PdfPasswordError } from "@/lib/importers/cas/extract";
import { parseCas, type CasEntry, type CasStatement } from "@/lib/importers/cas/parse";

export interface CasRow extends CasEntry {
  /** Suggested target: an existing account id, or "new". */
  target: string;
}

export type CasParseState =
  | { error?: string; statement?: undefined }
  | { error?: undefined; statement: Omit<CasStatement, "entries">; rows: CasRow[] };

const MAX_BYTES = 10 * 1024 * 1024;

/** Step 1: read the PDF in memory and propose updates. Nothing is stored. */
export async function parseCasUpload(_: CasParseState | undefined, form: FormData): Promise<CasParseState> {
  const user = await requireUser();
  const file = form.get("file");
  const password = String(form.get("password") ?? "");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose your CAS PDF." };
  if (file.size > MAX_BYTES) return { error: "That file is over 10 MB. Is it the right statement?" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return { error: "That isn't a PDF file." };

  let lines: string[];
  try {
    lines = await extractPdfLines(bytes, password || undefined);
  } catch (err) {
    if (err instanceof PdfPasswordError) {
      return {
        error:
          err.reason === "needed"
            ? "This statement is password-protected. CAS passwords are usually your PAN in capitals."
            : "That password didn't open the PDF. CAS passwords are usually your PAN in capitals.",
      };
    }
    console.error("CAS extract failed", (err as Error).message);
    return { error: "Couldn't read that PDF." };
  }

  const { entries, ...statement } = parseCas(lines);
  const existing = (await listAccounts(user)).filter((a) => a.country === "IN");
  const rows = entries.map<CasRow>((e) => {
    const type = e.kind === "demat" ? "brokerage" : "mutual_funds";
    const match =
      existing.find((a) => a.refTail && a.refTail === e.refTail && a.type === type) ??
      (e.institution ? existing.find((a) => a.institution === e.institution && a.type === type) : undefined);
    return { ...e, target: match?.id ?? "new" };
  });
  return { statement, rows };
}

const applySchema = z.object({
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rows: z
    .array(
      z.object({
        include: z.boolean(),
        target: z.union([z.literal("new"), z.string().uuid()]),
        kind: z.enum(["demat", "mutual_funds"]),
        institution: z.string().trim().min(1).max(80),
        refTail: z.string().max(8),
        value: z.number().finite().min(0),
      }),
    )
    .max(50),
});

export type CasApplyInput = z.infer<typeof applySchema>;

/** Step 2: write the reviewed values. */
export async function applyCasImport(input: CasApplyInput): Promise<{ error?: string; updated?: number; created?: number }> {
  const user = await requireUser();
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { error: "Some rows are incomplete. Check the institution and value of each." };
  const { asOf, rows } = parsed.data;
  let updated = 0;
  let created = 0;
  for (const row of rows.filter((r) => r.include)) {
    const type = row.kind === "demat" ? "brokerage" : "mutual_funds";
    if (!getAccountType("IN", type)) continue;
    if (row.target === "new") {
      await createAccount(user, {
        country: "IN",
        type,
        currency: "INR",
        institution: row.institution,
        nickname: row.kind === "demat" ? "Demat (CAS)" : "Mutual funds (CAS)",
        balance: row.value,
        asOf,
        refTail: row.refTail,
        source: "cas",
      });
      created++;
    } else {
      const acc = await getAccount(user, row.target);
      if (!acc) continue;
      const { id: _id, updatedAt: _updatedAt, ...rest } = acc;
      await updateAccount(user, row.target, { ...rest, balance: row.value, asOf, refTail: row.refTail, source: "cas" });
      updated++;
    }
  }
  revalidatePath("/dashboard");
  return { updated, created };
}
