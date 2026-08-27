import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { haptic } from "@/lib/haptic";
import { homeScreenKind, isStandaloneApp, requestHomeScreenIcon } from "@/lib/install-home";

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
    const result = requestHomeScreenIcon();
    if (result === "added" || isStandaloneApp()) {
      setStandalone(true);
      toast("Уже на экране Домой");
      return;
    }
    if (result === "guide") return;
    if (kind === "telegram") {
      toast("Если окна не было: в шапке Telegram нажмите ••• → На экран «Домой»");
    } else {
      toast("Safari: Поделиться → На экран «Домой»");
    }
  };

  if (standalone) {
    return (
      <Card className="flex items-center gap-3 p-3">
        <BrandMark size={40} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">На экране Домой</div>
          <p className="text-xs text-muted-foreground">Ярлык с логотипом уже установлен.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3">
      <div className="flex items-center gap-3">
        <BrandMark size={48} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Иконка на iPhone</div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {kind === "telegram"
              ? "Добавьте хаб на экран Домой — откроется с логотипом, без ленты чатов."
              : "На рабочем столе появится кнопка запуска с логотипом."}
          </p>
        </div>
      </div>
      <Button className="mt-3 h-11 w-full" onClick={add}>
        <Smartphone className="size-4" />
        На экран Домой
      </Button>
    </Card>
  );
}
