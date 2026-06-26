import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

/**
 * AES-256-GCM encryption for secrets at rest (e.g. per-company AI API keys).
 * Key precedence: APP_ENCRYPTION_KEY (base64, 32 bytes) → derived from AUTH_SECRET.
 * Format: base64(iv).base64(tag).base64(ciphertext)
 */
function getKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (raw) {
    const b = Buffer.from(raw, "base64");
    if (b.length === 32) return b;
    // Fail loudly rather than silently deriving a *different* key from
    // AUTH_SECRET — that would make every previously-stored secret undecryptable.
    throw new Error("APP_ENCRYPTION_KEY must be exactly 32 bytes (base64).");
  }
  const secret = process.env.AUTH_SECRET;
  if (secret) return scryptSync(secret, "ep-secret-salt", 32);
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "APP_ENCRYPTION_KEY (32-byte base64) or AUTH_SECRET must be set in production.",
    );
  }
  return scryptSync("dev-insecure-secret-change-me", "ep-secret-salt", 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(".");
}

export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const [ivB, tagB, dataB] = payload.split(".");
    if (!ivB || !tagB || !dataB) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getKey(),
      Buffer.from(ivB, "base64"),
      { authTagLength: 16 }, // pin tag length so a truncated tag can't be accepted
    );
    decipher.setAuthTag(Buffer.from(tagB, "base64"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    // A non-empty payload that fails to decrypt means a key rotation / corruption
    // problem — surface it (without leaking the secret) instead of silently
    // returning null, which callers would mistake for "no secret configured".
    console.error("[crypto] decryptSecret failed for a non-empty payload — check APP_ENCRYPTION_KEY/AUTH_SECRET rotation.");
    return null;
  }
}
