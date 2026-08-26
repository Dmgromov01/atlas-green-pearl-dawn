import { useEffect } from "react";
import { hubLogin, hubMe } from "@/lib/server/hub-auth";
import { deviceId, readHubToken, useHub } from "@/lib/stores/hub";
import { useSettings } from "@/lib/stores/settings";
import { getWebApp, tryBiometric } from "@/lib/telegram/webapp";
import { HubRuntime } from "@/components/hub-runtime";

function loadTelegramScript() {
  if (typeof document === "undefined") return Promise.resolve();
  if (getWebApp()) return Promise.resolve();
  const existing = document.getElementById("tg-webapp-sdk");
  if (existing) {
    return new Promise<void>((resolve) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => resolve(), { once: true });
      setTimeout(() => resolve(), 800);
    });
  }
  return new Promise<void>((resolve) => {
    const s = document.createElement("script");
    s.id = "tg-webapp-sdk";
    s.src = "https://telegram.org/js/telegram-web-app.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
    setTimeout(() => resolve(), 1200);
  });
}

export function TelegramBoot() {
  const setSession = useHub((s) => s.setSession);
  const setLoginError = useHub((s) => s.setLoginError);
  const name = useSettings((s) => s.displayName);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await loadTelegramScript();
      if (cancelled) return;
      const wa = getWebApp();
      wa?.ready();
      wa?.expand();

      const existing = readHubToken();
      if (existing) {
        try {
          const me = await hubMe({ data: { token: existing } });
          if (!cancelled) setSession(existing, me);
          return;
        } catch {
          sessionStorage.removeItem("r2d2.hub.token");
        }
      }
      try {
        const biometric = wa?.initData ? await tryBiometric() : false;
        const res = await hubLogin({
          data: {
            initData: wa?.initData || undefined,
            deviceId: deviceId(),
            displayName: name,
            biometric,
          },
        });
        if (cancelled) return;
        if ("token" in res) setSession(res.token, res.user);
        else setLoginError(res.error);
      } catch (err) {
        if (!cancelled) {
          setLoginError(err instanceof Error ? err.message : "Не удалось войти");
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [name, setSession, setLoginError]);

  return <HubRuntime />;
}
