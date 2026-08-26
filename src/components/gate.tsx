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
    const finish = () => {
      const hash = useSettings.getState().pinHash;
      setUnlocked(!hash || isSessionUnlocked());
      setReady(true);
    };
    if (useSettings.persist.hasHydrated()) finish();
    const unsub = useSettings.persist.onFinishHydration(finish);
    return unsub;
  }, [pinHash]);

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <p className="text-sm font-semibold tracking-[0.22em] text-muted-foreground">R2D2</p>
      </div>
    );
  }
  if (!onboarded) return <Onboarding />;
  if (pinHash && !unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />;
  return children;
}
