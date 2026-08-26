import { createJSONStorage } from "zustand/middleware";

const memory = new Map<string, string>();

function memoryStorage() {
  return {
    getItem: (name: string) => memory.get(name) ?? null,
    setItem: (name: string, value: string) => {
      memory.set(name, value);
    },
    removeItem: (name: string) => {
      memory.delete(name);
    },
  };
}

function localStorageSafe() {
  try {
    if (typeof localStorage === "undefined") return memoryStorage();
    const probe = "__r2d2_ls";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return memoryStorage();
  }
}

export const safeStorage = createJSONStorage(() => localStorageSafe());

export function persistOptions(name: string) {
  return {
    name,
    storage: safeStorage,
    skipHydration: true as const,
  };
}
