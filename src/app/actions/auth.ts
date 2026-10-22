"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { newWrappedDataKey } from "@/lib/crypto/envelope";
import { getDb, schema } from "@/lib/db";

export type FormState = { error?: string } | undefined;

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters.").max(200),
});

// Verified against when an email is unknown, so a miss takes as long as a wrong password.
const DUMMY_HASH = hashPassword("dummy-password-for-timing");

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentials.extend({ name: z.string().trim().max(80) }).safeParse({
    email: form.get("email"),
    password: form.get("password"),
    name: form.get("name") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password, name } = parsed.data;

  const db = getDb();
  const existing = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  if (existing.length) return { error: "An account with that email already exists. Try logging in." };

  const id = crypto.randomUUID();
  await db.insert(schema.users).values({
    id,
    email,
    name,
    passwordHash: await hashPassword(password),
    wrappedDek: newWrappedDataKey(id),
  });
  await createSession(id);
  redirect("/dashboard");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  const fail = { error: "That email and password don't match." };
  if (!parsed.success) return fail;
  const [user] = await getDb()
    .select({ id: schema.users.id, passwordHash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.email, parsed.data.email));
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? (await DUMMY_HASH));
  if (!user || !ok) return fail;
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
