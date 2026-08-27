import { getWebApp, isTelegram } from "@/lib/telegram/webapp";

export function isStandaloneApp() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone) || window.matchMedia("(display-mode: standalone)").matches;
}

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const touch = navigator.maxTouchPoints || 0;
  return /iPhone|iPod/.test(ua) || /iPad/.test(ua) || (/Macintosh/.test(ua) && touch > 1);
}

export function looksLikeTelegramWebView() {
  if (typeof window === "undefined") return false;
  if (isStandaloneApp()) return false;
  const ua = navigator.userAgent || "";
  const w = window as unknown as { TelegramWebviewProxy?: unknown };
  return /Telegram/i.test(ua) || Boolean(w.TelegramWebviewProxy) || isTelegram();
}

export function shouldLoadTelegramSdk() {
  if (typeof window === "undefined") return false;
  if (isStandaloneApp()) return false;
  const ua = navigator.userAgent || "";
  const w = window as unknown as { TelegramWebviewProxy?: unknown };
  return /Telegram/i.test(ua) || Boolean(w.TelegramWebviewProxy);
}

export type HomeScreenKind = "telegram" | "ios" | "other";

export function homeScreenKind(): HomeScreenKind {
  if (looksLikeTelegramWebView()) return "telegram";
  if (isIosDevice()) return "ios";
  return "other";
}

export function publicAppUrl() {
  return `${window.location.origin}/`;
}

export function installGuideUrl() {
  const next = new URL("/", window.location.origin);
  next.searchParams.set("install", "1");
  next.searchParams.set("platform", "ios");
  return next.toString();
}

/** Open the website in Safari — never Telegram's home-screen shortcut. */
export function openSiteForHomeScreen(): "safari" | "guide" | "copy" | "added" {
  if (isStandaloneApp()) return "added";
  const url = installGuideUrl();
  const wa = getWebApp();
  if (looksLikeTelegramWebView() && wa?.openLink) {
    try {
      wa.openLink(url, { try_instant_view: false });
      return "safari";
    } catch {
      /* fall through */
    }
  }
  if (isIosDevice() && !looksLikeTelegramWebView()) {
    window.location.assign(url);
    return "guide";
  }
  void navigator.clipboard?.writeText(publicAppUrl()).catch(() => {});
  return "copy";
}
