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

export type HomeScreenKind = "telegram" | "ios" | "other";

export function homeScreenKind(): HomeScreenKind {
  if (isTelegram()) return "telegram";
  if (isIosDevice()) return "ios";
  return "other";
}

export function openIosInstallGuide() {
  const next = new URL(window.location.href);
  next.searchParams.set("install", "1");
  next.searchParams.set("platform", "ios");
  const q = next.searchParams.toString();
  window.location.assign(`${next.pathname}?${q}`);
}

export function requestHomeScreenIcon(): "added" | "guide" | "prompted" {
  if (isStandaloneApp()) return "added";
  const wa = getWebApp();
  if (wa?.addToHomeScreen) {
    try {
      wa.checkHomeScreenStatus?.((status) => {
        if (status === "added") return;
        wa.addToHomeScreen?.();
      });
      if (!wa.checkHomeScreenStatus) wa.addToHomeScreen();
      return "prompted";
    } catch {
      return "prompted";
    }
  }
  if (isTelegram()) return "prompted";
  if (isIosDevice()) {
    openIosInstallGuide();
    return "guide";
  }
  return "prompted";
}
