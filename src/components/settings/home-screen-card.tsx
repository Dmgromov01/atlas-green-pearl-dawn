import { useEffect, useState } from "react";
import { toast } from "sonner";
import { haptic } from "@/lib/haptic";
import { isIosDevice, isStandaloneApp, openSiteForHomeScreen } from "@/lib/install-home";

export function HomeScreenCard({ home }: { home?: boolean }) {
  const [standalone, setStandalone] = useState(true);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setStandalone(isStandaloneApp());
    setIos(isIosDevice());
  }, []);

  if (home) return null;
  if (standalone) return null;

  return (
    <button
      type="button"
      className="min-h-11 w-full px-1 py-2 text-left text-sm text-muted-foreground"
      onClick={() => {
        haptic();
        const result = openSiteForHomeScreen();
        if (result === "copy") toast("Ссылка скопирована");
      }}
    >
      {ios ? "Добавить на экран Домой" : "Скопировать ссылку на хаб"}
    </button>
  );
}
