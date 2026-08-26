import { useEffect, type ReactNode } from "react";
import { useSettings } from "@/lib/stores/settings";
import { applyTelegramChrome, getWebApp, onMiniAppReady, onTelegramEvent } from "@/lib/telegram/webapp";

function applyTheme(theme: "light" | "dark" | "system") {
  const root = document.documentElement;
  const tg = getWebApp()?.colorScheme;
  const dark =
    theme === "dark" ||
    (theme === "system" && (tg ? tg === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches));
  root.classList.toggle("dark", dark);
  applyTelegramChrome(dark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    applyTheme(theme);
    const offReady = onMiniAppReady(() => applyTheme(theme));
    const offTg = onTelegramEvent("themeChanged", () => applyTheme(theme));
    if (theme !== "system") {
      return () => {
        offReady();
        offTg();
      };
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => {
      offReady();
      offTg();
      mq.removeEventListener("change", onChange);
    };
  }, [theme]);

  return children;
}
