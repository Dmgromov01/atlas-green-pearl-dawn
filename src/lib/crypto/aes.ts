import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

function masterKey() {
  const secret =
    process.env.AI_KEY_SECRET ||
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.OPENCLAW_GATEWAY_TOKEN ||
    "r2d2-preview-only-key";
  return scryptSync(secret, "r2d2-byok-v1", 32);
}

/** AES-256-GCM blob: base64(iv 12 | tag 16 | ciphertext) */
export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(blob: string) {
  const buf = Buffer.from(blob, "base64");
  if (buf.length < 29) throw new Error("Повреждённый ключ");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function keyHint(key: string) {
  const trimmed = key.trim();
  if (trimmed.length < 8) return "••••";
  return `••••${trimmed.slice(-4)}`;
}
