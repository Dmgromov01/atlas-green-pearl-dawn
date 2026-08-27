import { useEffect } from "react";

/** Kill any leftover service worker from the failed cache experiment. */
export function SwBoot() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void (async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith("ai-hub")).map((key) => caches.delete(key)));
      }
    })().catch(() => {});
  }, []);
  return null;
}
