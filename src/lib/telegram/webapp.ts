export type TgWebApp = {
  initData: string;
  initDataUnsafe?: { user?: { id: number; first_name?: string; username?: string } };
  ready: () => void;
  expand: () => void;
  BiometricManager?: {
    isInited: boolean;
    isBiometricAvailable: boolean;
    isAccessGranted: boolean;
    init: (cb?: () => void) => void;
    requestAccess: (opts: { reason: string }, cb?: (ok: boolean) => void) => void;
    authenticate: (opts: { reason: string }, cb?: (ok: boolean, token?: string) => void) => void;
  };
};

export function getWebApp(): TgWebApp | null {
  if (typeof window === "undefined") return null;
  const tg = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
  return tg && typeof tg.ready === "function" ? tg : null;
}

export function hasTelegramInitData() {
  const wa = getWebApp();
  return Boolean(wa?.initData);
}

export function tryBiometric(): Promise<boolean> {
  const bio = getWebApp()?.BiometricManager;
  if (!bio) return Promise.resolve(false);
  return new Promise((resolve) => {
    const run = () => {
      if (!bio.isBiometricAvailable) return resolve(false);
      const auth = () =>
        bio.authenticate({ reason: "Открыть Personal AI Hub" }, (ok) => resolve(Boolean(ok)));
      if (bio.isAccessGranted) auth();
      else bio.requestAccess({ reason: "Быстрый вход в Personal AI Hub" }, (ok) => (ok ? auth() : resolve(false)));
    };
    if (bio.isInited) run();
    else bio.init(run);
    setTimeout(() => resolve(false), 4000);
  });
}
