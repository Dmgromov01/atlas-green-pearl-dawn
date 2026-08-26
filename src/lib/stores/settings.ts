import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { City, HubModuleId } from "@/lib/hub/types";
import { persistOptions } from "./persist";

export const MOSCOW: City = {
  name: "Москва",
  lat: 55.7558,
  lon: 37.6173,
  tz: "Europe/Moscow",
  country: "Россия",
};

type ThemePref = "light" | "dark" | "system";

export type IcloudCalMode = "family" | "split";

export type ReminderPrefs = {
  morning: boolean;
  events: boolean;
  evening: boolean;
};

type SettingsState = {
  displayName: string;
  onboarded: boolean;
  theme: ThemePref;
  city: City;
  enabledModules: HubModuleId[] | "all";
  pinSalt: string | null;
  pinHash: string | null;
  icsUrl: string;
  familyShare: boolean;
  icloudCal: IcloudCalMode;
  reminders: ReminderPrefs;
  setDisplayName: (name: string) => void;
  setOnboarded: (v: boolean) => void;
  completeOnboarding: (name: string, city: City) => void;
  setTheme: (theme: ThemePref) => void;
  setCity: (city: City) => void;
  setEnabledModules: (ids: HubModuleId[] | "all") => void;
  setPin: (salt: string, hash: string) => void;
  clearPin: () => void;
  setIcsUrl: (url: string) => void;
  setFamilyShare: (v: boolean) => void;
  setIcloudCal: (v: IcloudCalMode) => void;
  setReminders: (patch: Partial<ReminderPrefs>) => void;
  resetAll: () => void;
};

const initialReminders: ReminderPrefs = { morning: true, events: true, evening: true };

const initial = {
  displayName: "",
  onboarded: false,
  theme: "system" as ThemePref,
  city: MOSCOW,
  enabledModules: "all" as const,
  pinSalt: null as string | null,
  pinHash: null as string | null,
  icsUrl: "",
  familyShare: true,
  icloudCal: "family" as IcloudCalMode,
  reminders: initialReminders,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...initial,
      setDisplayName: (displayName) => set({ displayName }),
      setOnboarded: (onboarded) => set({ onboarded }),
      completeOnboarding: (displayName, city) => set({ displayName, city, onboarded: true }),
      setTheme: (theme) => set({ theme }),
      setCity: (city) => set({ city }),
      setEnabledModules: (enabledModules) => set({ enabledModules }),
      setPin: (pinSalt, pinHash) => set({ pinSalt, pinHash }),
      clearPin: () => set({ pinSalt: null, pinHash: null }),
      setIcsUrl: (icsUrl) => set({ icsUrl }),
      setFamilyShare: (familyShare) => set({ familyShare }),
      setIcloudCal: (icloudCal) => set({ icloudCal }),
      setReminders: (patch) =>
        set((s) => ({ reminders: { ...(s.reminders ?? initialReminders), ...patch } })),
      resetAll: () => set({ ...initial }),
    }),
    {
      ...persistOptions("r2d2.settings.v1"),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        const city = p.city;
        const cityOk =
          city &&
          typeof city.name === "string" &&
          Number.isFinite(Number(city.lat)) &&
          Number.isFinite(Number(city.lon)) &&
          typeof city.tz === "string";
        const named = Boolean(String(p.displayName ?? "").trim());
        return {
          ...current,
          ...p,
          onboarded: Boolean(p.onboarded) && named,
          city: cityOk ? city : current.city,
          reminders: { ...initialReminders, ...(p.reminders ?? current.reminders) },
          icsUrl: p.icsUrl ?? current.icsUrl ?? "",
          familyShare: p.familyShare ?? current.familyShare ?? true,
          icloudCal: p.icloudCal === "split" ? "split" : "family",
        };
      },
    },
  ),
);

export async function hashPin(pin: string, saltHex?: string) {
  const enc = new TextEncoder();
  const salt = saltHex
    ? Uint8Array.from(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)))
    : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" },
    key,
    256,
  );
  const hash = [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const saltOut = [...salt].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { salt: saltOut, hash };
}

export async function verifyPin(pin: string, salt: string, hash: string) {
  const next = await hashPin(pin, salt);
  if (next.hash.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= next.hash.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}
