import { create } from "zustand";
import type { HubUserPublic } from "@/lib/hub/identity";

const TOKEN = "r2d2.hub.token";
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
  return sessionStorage.getItem(TOKEN) || "";
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
    sessionStorage.setItem(TOKEN, token);
    set({ token, user, loginError: null });
  },
  setLoginError: (loginError) => set({ loginError }),
  clear: () => {
    sessionStorage.removeItem(TOKEN);
    set({ token: "", user: null, loginError: null });
  },
}));
