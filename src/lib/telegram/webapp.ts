import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

const SDK_SRC = "https://telegram.org/js/telegram-web-app.js";
const SDK_ID = "tg-webapp-sdk";

export type TgHaptic = {
  impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
  notificationOccurred: (type: "error" | "success" | "warning") => void;
};

export type TgBackButton = {
  isVisible?: boolean;
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
};

export type TgWebApp = {
  initData: string;
  initDataUnsafe?: {
    user?: { id: number; first_name?: string; last_name?: string; username?: string };
    start_param?: string;
  };
  colorScheme?: "light" | "dark";
  themeParams?: { bg_color?: string; text_color?: string; header_bg_color?: string };
  startParam?: string;
  ready: () => void;
  expand: () => void;
  close?: () => void;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  onEvent?: (event: string, handler: () => void) => void;
  offEvent?: (event: string, handler: () => void) => void;
  HapticFeedback?: TgHaptic;
  BackButton?: TgBackButton;
  BiometricManager?: {
    isInited: boolean;
    isBiometricAvailable: boolean;
    isAccessGranted: boolean;
    init: (cb?: () => void) => void;
    requestAccess: (opts: { reason: string }, cb?: (ok: boolean) => void) => void;
    authenticate: (opts: { reason: string }, cb?: (ok: boolean, token?: string) => void) => void;
  };
};

const START_PATH: Record<string, string> = {
  chat: "/chat",
  calendar: "/calendar",
  settings: "/settings",
  digest: "/digest",
  translate: "/translate",
  admin: "/admin",
};

export function getWebApp(): TgWebApp | null {
  if (typeof window === "undefined") return null;
  const tg = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
  return tg && typeof tg.ready === "function" ? tg : null;
}

export function isTelegram() {
  return Boolean(getWebApp()?.initData);
}

export function startParam() {
  const wa = getWebApp();
  return (wa?.startParam || wa?.initDataUnsafe?.start_param || "").trim();
}

export function startPath() {
  const key = startParam().toLowerCase();
  return START_PATH[key] ?? null;
}

export function telegramUserName() {
  const u = getWebApp()?.initDataUnsafe?.user;
  return u?.first_name?.trim() || "";
}

export function loadTelegramSdk(): Promise<TgWebApp | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  const existing = getWebApp();
  if (existing) return Promise.resolve(existing);
  const node = document.getElementById(SDK_ID);
  if (node) {
    return new Promise((resolve) => {
      node.addEventListener("load", () => resolve(getWebApp()), { once: true });
      node.addEventListener("error", () => resolve(null), { once: true });
      setTimeout(() => resolve(getWebApp()), 800);
    });
  }
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.id = SDK_ID;
    s.src = SDK_SRC;
    s.async = true;
    s.onload = () => resolve(getWebApp());
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
    setTimeout(() => resolve(getWebApp()), 1200);
  });
}

export function applyTelegramChrome(dark: boolean) {
  const wa = getWebApp();
  if (!wa) return;
  const header = dark ? "#0f141c" : "#F5F7FB";
  const bg = dark ? "#0f141c" : "#F5F7FB";
  try {
    wa.setHeaderColor?.(header);
    wa.setBackgroundColor?.(bg);
  } catch {
    /* older clients */
  }
  document.documentElement.classList.toggle("tg-mini", Boolean(wa.initData));
}

let readyListeners = new Set<() => void>();

export function onMiniAppReady(cb: () => void) {
  if (getWebApp()?.BackButton) cb();
  readyListeners.add(cb);
  return () => {
    readyListeners.delete(cb);
  };
}

function emitMiniAppReady() {
  readyListeners.forEach((cb) => cb());
}

export function bootMiniApp() {
  const wa = getWebApp();
  if (!wa) return null;
  wa.ready();
  wa.expand();
  try {
    wa.disableVerticalSwipes?.();
  } catch {
    /* older clients */
  }
  applyTelegramChrome(wa.colorScheme === "dark");
  emitMiniAppReady();
  return wa;
}

export function onTelegramEvent(event: string, handler: () => void) {
  const wa = getWebApp();
  wa?.onEvent?.(event, handler);
  return () => wa?.offEvent?.(event, handler);
}

export function hapticImpact(kind: "light" | "medium" | "heavy" | "success" = "light") {
  const fb = getWebApp()?.HapticFeedback;
  if (!fb) return false;
  try {
    if (kind === "success") fb.notificationOccurred("success");
    else fb.impactOccurred(kind);
    return true;
  } catch {
    return false;
  }
}

export function tryBiometric(): Promise<boolean> {
  const bio = getWebApp()?.BiometricManager;
  if (!bio) return Promise.resolve(false);
  return new Promise((resolve) => {
    const run = () => {
      if (!bio.isBiometricAvailable) return resolve(false);
      const auth = () =>
        bio.authenticate({ reason: "Открыть AI Personal Hub" }, (ok) => resolve(Boolean(ok)));
      if (bio.isAccessGranted) auth();
      else bio.requestAccess({ reason: "Быстрый вход в AI Personal Hub" }, (ok) => (ok ? auth() : resolve(false)));
    };
    if (bio.isInited) run();
    else bio.init(run);
    setTimeout(() => resolve(false), 4000);
  });
}

/** Native Telegram back on nested screens; no-op in a regular browser. */
export function useTelegramBack(to?: string) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(() => Boolean(getWebApp()?.BackButton));
  useEffect(() => onMiniAppReady(() => setReady(true)), []);
  useEffect(() => {
    const btn = getWebApp()?.BackButton;
    if (!btn || !to || !ready) {
      btn?.hide();
      return;
    }
    const go = () => navigate({ to });
    btn.show();
    btn.onClick(go);
    return () => {
      btn.offClick(go);
      btn.hide();
    };
  }, [to, navigate, ready]);
  return ready && Boolean(to);
}
