import { create } from "zustand";
import type { HubUserPublic } from "@/lib/hub/identity";

const TOKEN = "r2d2.hub.token";
const USER = "r2d2.hub.user";

export function readHubToken() {
  if (typeof window === "undefined") return "";
  return "";
}

function readHubUser(): HubUserPublic | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER);
    return raw ? (JSON.parse(raw) as HubUserPublic) : null;
  } catch {
    return null;
  }
}

function dropLegacyToken() {
  try {
    localStorage.removeItem(TOKEN);
    sessionStorage.removeItem(TOKEN);
  } catch {
    /* ignore */
  }
}

type HubState = {
  ready: boolean;
  needsSetup: boolean;
  token: string;
  user: HubUserPublic | null;
  loginError: string | null;
  setReady: (ready: boolean, needsSetup?: boolean) => void;
  setSession: (token: string, user: HubUserPublic) => void;
  setLoginError: (error: string | null) => void;
  clear: () => void;
};

export const useHub = create<HubState>()((set) => ({
  ready: false,
  needsSetup: false,
  token: "",
  user: null,
  loginError: null,
  setReady: (ready, needsSetup) =>
    set((s) => ({ ready, needsSetup: needsSetup ?? s.needsSetup })),
  setSession: (token, user) => {
    dropLegacyToken();
    try {
      localStorage.setItem(USER, JSON.stringify(user));
    } catch {
      /* private mode */
    }
    set({
      token: token || "cookie",
      user,
      loginError: null,
      ready: true,
      needsSetup: false,
    });
  },
  setLoginError: (loginError) => set({ loginError }),
  clear: () => {
    dropLegacyToken();
    try {
      localStorage.removeItem(USER);
    } catch {
      /* ignore */
    }
    set({ token: "", user: null, loginError: null, ready: true });
  },
}));

export function restoreHubSession() {
  dropLegacyToken();
  const user = readHubUser();
  if (user) useHub.setState({ user });
  return "";
}
