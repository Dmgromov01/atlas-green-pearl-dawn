import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { haptic } from "@/lib/haptic";
import { homeScreenKind, isStandaloneApp, openSiteForHomeScreen, publicAppUrl } from "@/lib/install-home";

export function HomeScreenCard({ home }: { home?: boolean }) {
  const [standalone, setStandalone] = useState(false);
  const [kind, setKind] = useState<ReturnType<typeof homeScreenKind>>("other");

  useEffect(() => {
    setStandalone(isStandaloneApp());
    setKind(homeScreenKind());
  }, []);

  if (home && kind === "other") return null;
  if (home && standalone) return null;

  const add = () => {
    haptic("medium");
    const result = openSiteForHomeScreen();
    if (result === "added" || isStandaloneApp()) {
      setStandalone(true);
      toast("Уже открыто как приложение");
      return;
    }
    if (result === "safari") {
      toast("В Safari: Поделиться → На экран «Домой»");
      return;
    }
    if (result === "guide") return;
    toast(`Ссылка скопирована: ${publicAppUrl()}`);
  };

  if (standalone) {
    return (
      <Card className="flex items-center gap-3 p-3">
        <BrandMark size={40} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Приложение на Домой</div>
          <p className="text-xs text-muted-foreground">Открывается сразу на сайт, без Telegram.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3">
      <div className="flex items-center gap-3">
        <BrandMark size={48} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Ярлык на сайт</div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Старый значок из Telegram удалите. Новый откроет хаб как отдельное приложение.
          </p>
        </div>
      </div>
      <ol className="mt-3 space-y-1 text-xs leading-relaxed text-muted-foreground">
        <li>1. Удержание старой иконки → Удалить</li>
        <li>2. {kind === "telegram" ? "Откройте сайт в Safari" : "Поделиться в Safari"}</li>
        <li>3. На экран «Домой»</li>
      </ol>
      <Button className="mt-3 h-11 w-full" onClick={add}>
        <Smartphone className="size-4" />
        {kind === "telegram" ? "Открыть сайт" : "Показать, как добавить"}
      </Button>
    </Card>
  );
}
