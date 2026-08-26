import { useQuery } from "@tanstack/react-query";
import { icloudStatus } from "@/lib/server/icloud";
import { useHub } from "@/lib/stores/hub";
import { useSettings } from "@/lib/stores/settings";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { SectionLabel } from "@/components/shell/page";
import { haptic } from "@/lib/haptic";

export function FamilyCard() {
  const token = useHub((s) => s.token);
  const familyShare = useSettings((s) => s.familyShare);
  const setFamilyShare = useSettings((s) => s.setFamilyShare);
  const icloudCal = useSettings((s) => s.icloudCal);
  const setIcloudCal = useSettings((s) => s.setIcloudCal);

  const status = useQuery({
    queryKey: ["icloud", token],
    queryFn: () => icloudStatus({ data: { token } }),
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  const familyCal = status.data?.connected
    ? status.data.calendars.find((c) => c.href === status.data.familyHref) ||
      status.data.calendars.find((c) => c.family)
    : null;

  return (
    <Card className="space-y-3 p-4">
      <SectionLabel>Семейный доступ</SectionLabel>
      <p className="text-sm leading-snug text-muted-foreground">
        Встречи с хаба пишутся в iCloud «Семья» — у всех iPhone семьи они появляются сами.
        Состав семьи меняется на iPhone: Настройки → Семья.
      </p>
      <div className="rounded-2xl bg-muted px-3 py-2 text-sm">
        {status.isFetching && !status.data ? (
          <span className="text-muted-foreground">Проверяю iCloud…</span>
        ) : familyCal ? (
          <span className="font-semibold text-accent">iCloud «{familyCal.name}» · подключена</span>
        ) : status.data?.connected ? (
          <span className="text-muted-foreground">iCloud есть, календарь «Семья» не выбран</span>
        ) : (
          <span className="text-muted-foreground">iCloud ещё не подключен</span>
        )}
      </div>
      <div>
        <div className="mb-1.5 text-xs font-bold text-muted-foreground">Куда писать встречи</div>
        <div className="seg">
          <button
            type="button"
            className={`seg__btn ${icloudCal !== "split" ? "is-on" : ""}`}
            onClick={() => {
              setIcloudCal("family");
              haptic();
            }}
          >
            Все в «Семья»
          </button>
          <button
            type="button"
            className={`seg__btn ${icloudCal === "split" ? "is-on" : ""}`}
            onClick={() => {
              setIcloudCal("split");
              haptic();
            }}
          >
            Home / Семья
          </button>
        </div>
        <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
          {icloudCal === "split"
            ? "Личные — в Home. Иконка семьи — в календарь «Семья»."
            : "Каждая встреча из хаба сразу в семейный календарь iPhone."}
        </p>
      </div>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Общие задачи и Inbox в хабе</div>
          <div className="text-xs text-muted-foreground">Пометка «семья» видна допущенным в приложении</div>
        </div>
        <Switch checked={familyShare} onCheckedChange={setFamilyShare} />
      </div>
    </Card>
  );
}
