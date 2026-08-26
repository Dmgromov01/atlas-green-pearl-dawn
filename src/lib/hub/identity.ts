export type HubRole = "admin" | "user";
export type AiMode = "off" | "byok" | "shared";
export type AuthMethod = "initData" | "pin" | "biometric" | "preview";
export type KeySource = "byok" | "shared" | "none";
export type ByokProvider = "openai" | "anthropic" | "openclaw" | "custom";

export type HubUserPublic = {
  id: string;
  telegramId: string | null;
  username: string | null;
  displayName: string;
  role: HubRole;
  allowed: boolean;
  aiMode: AiMode;
  allowGlobalAi: boolean;
  quotaDaily: number;
  quotaUsed: number;
  byokProvider: ByokProvider | null;
  byokHint: string | null;
  hasPin: boolean;
};

export const SESSION_TTL_SEC = () => {
  const n = Number(process.env.SESSION_TTL_SECONDS || 7 * 24 * 3600);
  return Number.isFinite(n) && n >= 3600 ? n : 7 * 24 * 3600;
};
