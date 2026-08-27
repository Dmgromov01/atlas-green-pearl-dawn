import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { hubLogin, hubMe } from "@/lib/server/hub-auth";
import { deviceId, readHubToken, useHub } from "@/lib/stores/hub";
import { useSettings } from "@/lib/stores/settings";
import {
  applyTelegramChrome,
  bootMiniApp,
  loadTelegramSdk,
  startPath,
  telegramUserName,
  tryBiometric,
} from "@/lib/telegram/webapp";
import { HubRuntime } from "@/components/hub-runtime";

export function TelegramBoot() {
  const navigate = useNavigate();
  const setSession = useHub((s) => s.setSession);
  const setLoginError = useHub((s) => s.setLoginError);
  const name = useSettings((s) => s.displayName);
  const onboarded = useSettings((s) => s.onboarded);
  const jumped = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await loadTelegramSdk();
      if (cancelled) return;
      const wa = bootMiniApp();
      applyTelegramChrome(wa?.colorScheme === "dark");

      const tgName = telegramUserName();
      const current = useSettings.getState().displayName;
      if (tgName && (!current || current === "Гость")) {
        useSettings.getState().setDisplayName(tgName);
      }

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
            displayName: useSettings.getState().displayName || tgName,
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

  useEffect(() => {
    if (!onboarded || jumped.current) return;
    const path = startPath();
    if (!path) return;
    jumped.current = true;
    void navigate({ to: path });
  }, [onboarded, navigate]);

  return <HubRuntime />;
}
