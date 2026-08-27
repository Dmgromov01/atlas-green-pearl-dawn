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

export function publicAppUrl() {
  return `${window.location.origin}/`;
}

export function installGuideUrl() {
  const next = new URL("/", window.location.origin);
  next.searchParams.set("install", "1");
  next.searchParams.set("platform", "ios");
  return next.toString();
}

export function openSiteForHomeScreen(): "guide" | "copy" | "added" {
  if (isStandaloneApp()) return "added";
  if (isIosDevice()) {
    window.location.assign(installGuideUrl());
    return "guide";
  }
  void navigator.clipboard?.writeText(publicAppUrl()).catch(() => {});
  return "copy";
}
