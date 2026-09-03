import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { gcalStatus } from "@/lib/server/gcal";
import { hubCreateInvite, hubListInvites } from "@/lib/server/hub-auth";
import { useHub } from "@/lib/stores/hub";
import { useSettings } from "@/lib/stores/settings";
import { roleLabel } from "@/lib/hub/identity";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SectionLabel } from "@/components/shell/page";
import { haptic } from "@/lib/haptic";

export function FamilyCard() {
  const token = useHub((s) => s.token);
  const me = useHub((s) => s.user);
  const familyShare = useSettings((s) => s.familyShare);
  const setFamilyShare = useSettings((s) => s.setFamilyShare);
  const qc = useQueryClient();

  const gcal = useQuery({
    queryKey: ["gcal", token],
    queryFn: () => gcalStatus({ data: { token } }),
    enabled: Boolean(token),
    staleTime: 30_000,
  });
  const invites = useQuery({
    queryKey: ["invites"],
    queryFn: () => hubListInvites({ data: { token } }),
    enabled: Boolean(token && me?.role === "admin"),
  });

  const invite = useMutation({
    mutationFn: () => hubCreateInvite({ data: { token } }),
    onSuccess: async (res) => {
      haptic("success");
      try {
        await navigator.clipboard.writeText(res.url);
        toast("Ссылка скопирована. Действует 7 дней.");
      } catch {
        toast(res.url);
      }
      void qc.invalidateQueries({ queryKey: ["invites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="space-y-3 p-4">
      <SectionLabel>Семья</SectionLabel>
      <p className="text-sm leading-snug text-muted-foreground">
        Вы {me ? roleLabel(me.role) : "гость"}. Общего пароля нет — только личный Face ID / PIN и одноразовый инвайт.
      </p>
      <div className="rounded-md bg-muted px-3 py-2 text-sm">
        {gcal.data?.connected ? (
          <span className="font-semibold text-accent">
            Google Calendar · {gcal.data.familyId ? "семейный календарь выбран" : "подключен, семейный не выбран"}
          </span>
        ) : (
          <span className="text-muted-foreground">Семейный календарь — Google. Сейчас не подключен.</span>
        )}
      </div>
      <p className="text-xs leading-snug text-muted-foreground">
        Семейные встречи пишутся в Google Calendar. iCloud CalDAV в хабе отключён.
      </p>
      {me?.role === "admin" ? (
        <div className="space-y-2">
          <Button className="w-full" variant="secondary" onClick={() => void invite.mutate()}>
            Пригласить в семью
          </Button>
          {(invites.data ?? []).slice(0, 5).map((inv) => (
            <div key={inv.id} className="text-xs text-muted-foreground">
              {inv.used_at ? "использован" : "ждёт"} · до {inv.expires_at.slice(0, 10)}
              {inv.display_name ? ` · ${inv.display_name}` : ""}
            </div>
          ))}
        </div>
      ) : null}
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
