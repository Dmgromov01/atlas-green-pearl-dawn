import { useEffect } from "react";
import { hubMe, hubStatus } from "@/lib/server/hub-auth";
import { restoreHubSession, useHub } from "@/lib/stores/hub";
import { useSettings } from "@/lib/stores/settings";
import { HubRuntime } from "@/components/hub-runtime";

export function HubBoot() {
  const setSession = useHub((s) => s.setSession);
  const setReady = useHub((s) => s.setReady);
  const setLoginError = useHub((s) => s.setLoginError);
  const clear = useHub((s) => s.clear);

  useEffect(() => {
    restoreHubSession();
    let cancelled = false;
    const run = async () => {
      try {
        const status = await hubStatus();
        if (cancelled) return;
        try {
          const me = await hubMe({ data: {} });
          if (cancelled) return;
          setSession("cookie", me);
          if (me.displayName) useSettings.getState().completeOnboarding(me.displayName);
          return;
        } catch {
          if (cancelled) return;
          clear();
          setReady(true, status.needsSetup);
        }
      } catch (err) {
        if (!cancelled) {
          setLoginError(err instanceof Error ? err.message : "Нет связи с хабом");
          setReady(true, false);
        }
      }
    };
    const idle = window.setTimeout(() => void run(), 40);
    return () => {
      cancelled = true;
      window.clearTimeout(idle);
    };
  }, [setSession, setReady, setLoginError, clear]);

  return <HubRuntime />;
}
