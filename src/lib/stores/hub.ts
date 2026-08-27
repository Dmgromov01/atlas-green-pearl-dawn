import { create } from "zustand";
import type { HubUserPublic } from "@/lib/hub/identity";

const TOKEN = "r2d2.hub.token";
const USER = "r2d2.hub.user";
const DEVICE = "r2d2.device";

export function deviceId() {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(DEVICE);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE, id);
  }
  return id;
}

export function readHubToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TOKEN) || sessionStorage.getItem(TOKEN) || "";
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

type HubState = {
  token: string;
  user: HubUserPublic | null;
  loginError: string | null;
  setSession: (token: string, user: HubUserPublic) => void;
  setLoginError: (error: string | null) => void;
  clear: () => void;
};

export const useHub = create<HubState>()((set) => ({
  token: "",
  user: null,
  loginError: null,
  setSession: (token, user) => {
    try {
      localStorage.setItem(TOKEN, token);
      localStorage.setItem(USER, JSON.stringify(user));
      sessionStorage.setItem(TOKEN, token);
    } catch {
      /* private mode */
    }
    set({ token, user, loginError: null });
  },
  setLoginError: (loginError) => set({ loginError }),
  clear: () => {
    try {
      localStorage.removeItem(TOKEN);
      localStorage.removeItem(USER);
      sessionStorage.removeItem(TOKEN);
    } catch {
      /* ignore */
    }
    set({ token: "", user: null, loginError: null });
  },
}));

export function restoreHubSession() {
  const token = readHubToken();
  const user = readHubUser();
  if (!token) return "";
  if (user) useHub.getState().setSession(token, user);
  else useHub.setState({ token });
  return token;
}
