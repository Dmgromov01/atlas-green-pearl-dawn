import { useEffect, useState, type ReactNode } from "react";
import { useSettings } from "@/lib/stores/settings";
import { isSessionUnlocked } from "@/lib/pin-session";
import { LockScreen } from "./lock-screen";

export function Gate({ children }: { children: ReactNode }) {
  const pinHash = useSettings((s) => s.pinHash);
  const [unlocked, setUnlocked] = useState(true);

  useEffect(() => {
    const apply = () => setUnlocked(!useSettings.getState().pinHash || isSessionUnlocked());
    apply();
    return useSettings.persist.onFinishHydration(apply);
  }, [pinHash]);

  if (pinHash && !unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />;
  return children;
}
