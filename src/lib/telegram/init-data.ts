import { createHmac, timingSafeEqual } from "node:crypto";

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export function verifyInitData(
  initData: string,
  botToken: string,
  maxAgeSec = 86_400,
): TelegramUser | null {
  if (!initData || !botToken) return null;
  try {
    const params = new URLSearchParams(initData);
    const received = params.get("hash");
    if (!received) return null;
    params.delete("hash");
    const check = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
    const calc = createHmac("sha256", secret).update(check).digest("hex");
    const a = Buffer.from(calc, "utf8");
    const b = Buffer.from(received, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const authDate = Number(params.get("auth_date") || 0);
    if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;
    const raw = params.get("user");
    if (!raw) return null;
    const user = JSON.parse(raw) as TelegramUser;
    if (!user?.id) return null;
    return user;
  } catch {
    return null;
  }
}

export function botToken() {
  return (process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || "").trim();
}
