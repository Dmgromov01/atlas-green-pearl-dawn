import { useEffect } from "react";
import { hubLogin, hubMe } from "@/lib/server/hub-auth";
import { deviceId, readHubToken, restoreHubSession, useHub } from "@/lib/stores/hub";
import { useSettings } from "@/lib/stores/settings";
import { HubRuntime } from "@/components/hub-runtime";

export function HubBoot() {
  const setSession = useHub((s) => s.setSession);
  const setLoginError = useHub((s) => s.setLoginError);
  const name = useSettings((s) => s.displayName);

  useEffect(() => {
    restoreHubSession();
    let cancelled = false;
    const run = async () => {
      const existing = readHubToken();
      if (existing) {
        try {
          const me = await hubMe({ data: { token: existing } });
          if (!cancelled) setSession(existing, me);
          return;
        } catch {
          if (!cancelled) useHub.getState().clear();
        }
      }
      try {
        const res = await hubLogin({
          data: {
            deviceId: deviceId(),
            displayName: useSettings.getState().displayName,
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
    const idle = window.setTimeout(() => void run(), 80);
    return () => {
      cancelled = true;
      window.clearTimeout(idle);
    };
  }, [name, setSession, setLoginError]);

  return <HubRuntime />;
}
