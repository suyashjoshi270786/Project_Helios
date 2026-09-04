import crypto from "node:crypto";

// AES-256-GCM encryption for Environment variables classified Sensitive/
// Secret — the one genuinely new "reversible encryption" capability in this
// codebase (ApiToken/PasswordResetToken are intentionally one-way hashes and
// can't be reused here, since the real value must be recoverable to send in
// a request). Key comes from an env var, not the DB — losing/rotating it
// makes existing encrypted variables permanently undecryptable, same
// trade-off as JWT_SECRET.

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12; // 96-bit IV is the GCM-recommended size

export class EncryptionNotConfiguredError extends Error {
  constructor() {
    super("API_STUDIO_SECRET_ENCRYPTION_KEY is not configured — cannot store or read Sensitive/Secret variables.");
  }
}

let cachedKey: Buffer | null | undefined;

function getKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env.API_STUDIO_SECRET_ENCRYPTION_KEY;
  if (!raw) {
    cachedKey = null;
    return null;
  }
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== KEY_BYTES) {
    // Fail loudly rather than silently truncating/padding a misconfigured
    // key into something that "works" but isn't the key the operator meant.
    throw new Error(`API_STUDIO_SECRET_ENCRYPTION_KEY must decode to exactly ${KEY_BYTES} bytes (got ${decoded.length}).`);
  }
  cachedKey = decoded;
  return cachedKey;
}

export function isEncryptionConfigured(): boolean {
  return getKey() !== null;
}

// Format: base64(iv).base64(authTag).base64(ciphertext) — a fresh random IV
// every call, never reused.
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  if (!key) throw new EncryptionNotConfiguredError();

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${authTag.toString("base64")}.${ciphertext.toString("base64")}`;
}

export function decryptSecret(encoded: string): string {
  const key = getKey();
  if (!key) throw new EncryptionNotConfiguredError();

  const parts = encoded.split(".");
  if (parts.length !== 3) throw new Error("Malformed encrypted value.");
  const [ivB64, authTagB64, ciphertextB64] = parts;

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}
