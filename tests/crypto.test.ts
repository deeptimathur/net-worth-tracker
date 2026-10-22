import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { decryptJson, encryptJson, loadMasterKey, newWrappedDataKey, unwrapDataKey } from "@/lib/crypto/envelope";

const kek = randomBytes(32);

describe("envelope encryption", () => {
  it("round-trips a record under a user's wrapped key", () => {
    const wrapped = newWrappedDataKey("user-1", kek);
    const dek = unwrapDataKey(wrapped, "user-1", kek);
    const sealed = encryptJson(dek, { balance: 1234.5 }, "account:user-1");
    expect(sealed).not.toContain("1234");
    expect(decryptJson(dek, sealed, "account:user-1")).toEqual({ balance: 1234.5 });
  });

  it("refuses a key or record moved to another user", () => {
    const wrapped = newWrappedDataKey("user-1", kek);
    expect(() => unwrapDataKey(wrapped, "user-2", kek)).toThrow();
    const dek = unwrapDataKey(wrapped, "user-1", kek);
    const sealed = encryptJson(dek, { balance: 1 }, "account:user-1");
    expect(() => decryptJson(dek, sealed, "account:user-2")).toThrow();
  });

  it("detects tampering and a wrong master key", () => {
    const wrapped = newWrappedDataKey("u", kek);
    expect(() => unwrapDataKey(wrapped, "u", randomBytes(32))).toThrow();
    const dek = unwrapDataKey(wrapped, "u", kek);
    const parts = encryptJson(dek, { a: 1 }, "x").split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptJson(dek, parts.join("."), "x")).toThrow();
  });

  it("validates the master key", () => {
    expect(() => loadMasterKey("")).toThrow(/not set/);
    expect(() => loadMasterKey(Buffer.alloc(16).toString("base64"))).toThrow(/32 bytes/);
    expect(loadMasterKey(kek.toString("base64"))).toEqual(kek);
  });
});

describe("passwords", () => {
  it("hashes with a per-password salt and verifies", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).not.toBe(b);
    expect(await verifyPassword("correct horse battery", a)).toBe(true);
    expect(await verifyPassword("wrong", a)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});
