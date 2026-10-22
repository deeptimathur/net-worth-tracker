import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Envelope encryption for user financial data.
 *
 * Each user has a random 256-bit data key (DEK). The DEK is stored in the
 * users table wrapped (AES-256-GCM) under the app's master key (KEK) from
 * APP_ENCRYPTION_KEY. Record fields are encrypted under the DEK with an AAD
 * that binds the ciphertext to its owner and purpose, so a row copied to
 * another user or column fails to decrypt.
 *
 * Format: "v1.<iv>.<tag>.<ciphertext>" (base64url parts).
 */
const VERSION = "v1";

function b64(buf: Buffer): string {
  return buf.toString("base64url");
}

function seal(key: Buffer, plaintext: Buffer, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return [VERSION, b64(iv), b64(cipher.getAuthTag()), b64(ct)].join(".");
}

function open(key: Buffer, sealed: string, aad: string): Buffer {
  const [version, iv, tag, ct] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || ct === undefined) throw new Error("Unrecognised ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]);
}

export function loadMasterKey(value = process.env.APP_ENCRYPTION_KEY): Buffer {
  if (!value) throw new Error("APP_ENCRYPTION_KEY is not set");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("APP_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return key;
}

export function newWrappedDataKey(userId: string, kek = loadMasterKey()): string {
  return seal(kek, randomBytes(32), `dek:${userId}`);
}

export function unwrapDataKey(wrapped: string, userId: string, kek = loadMasterKey()): Buffer {
  return open(kek, wrapped, `dek:${userId}`);
}

export function encryptJson(dek: Buffer, value: unknown, aad: string): string {
  return seal(dek, Buffer.from(JSON.stringify(value)), aad);
}

export function decryptJson<T>(dek: Buffer, sealed: string, aad: string): T {
  return JSON.parse(open(dek, sealed, aad).toString("utf8")) as T;
}
