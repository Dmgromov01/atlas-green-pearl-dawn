import { useEffect, useState, type ReactNode } from "react";
import { useSettings } from "@/lib/stores/settings";
import { isSessionUnlocked } from "@/lib/pin-session";
import { Onboarding } from "./onboarding";
import { LockScreen } from "./lock-screen";

export function Gate({ children }: { children: ReactNode }) {
  const onboarded = useSettings((s) => s.onboarded);
  const pinHash = useSettings((s) => s.pinHash);
  const [unlocked, setUnlocked] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const hash = useSettings.getState().pinHash;
      setUnlocked(!hash || isSessionUnlocked());
      setReady(true);
    };
    try {
      if (useSettings.persist.hasHydrated()) {
        finish();
        return () => {
          done = true;
        };
      }
    } catch {
      /* ignore */
    }
    let unsub = () => {};
    try {
      unsub = useSettings.persist.onFinishHydration(finish);
    } catch {
      finish();
    }
    const t = window.setTimeout(finish, 50);
    return () => {
      done = true;
      unsub();
      window.clearTimeout(t);
    };
  }, [pinHash]);

  if (!ready) {
    return <div className="min-h-dvh bg-background" />;
  }
  if (!onboarded) return <Onboarding />;
  if (pinHash && !unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />;
  return children;
}
