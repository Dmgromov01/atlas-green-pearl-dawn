import { useState } from "react";
import { Bell, Mic, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { reminderCreate, reminderDelete, reminderList, reminderPreview } from "@/lib/server/reminders";
import { recurrenceLabel } from "@/lib/reminders/parse";
import { useHub } from "@/lib/stores/hub";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FoldCard } from "@/components/home/fold-card";
import { haptic } from "@/lib/haptic";

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  onresult: ((ev: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function listenOnce(): Promise<string> {
  const Ctor = (window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec })
    .SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
  if (!Ctor) return Promise.reject(new Error("Диктовка недоступна в этом браузере"));
  return new Promise((resolve, reject) => {
    const rec = new Ctor();
    rec.lang = "ru-RU";
    rec.interimResults = false;
    rec.onresult = (ev) => resolve(ev.results[0][0].transcript);
    rec.onend = () => {};
    try {
      rec.start();
    } catch (e) {
      reject(e);
    }
  });
}

function stamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function RemindersCard() {
  const token = useHub((s) => s.token);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<{ text: string; dueAt: string; recurrence: string } | null>(null);

  const list = useQuery({
    queryKey: ["reminders"],
    queryFn: () => reminderList({ data: { token } }),
    enabled: Boolean(token),
    staleTime: 20_000,
  });

  const previewMut = useMutation({
    mutationFn: () => reminderPreview({ data: { text } }),
    onSuccess: (p) => {
      setPreview(p);
      haptic();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: () =>
      reminderCreate({
        data: {
          token,
          text: preview?.text || text,
          dueAt: preview?.dueAt,
          recurrence: preview?.recurrence as "none" | "daily" | "weekly" | "weekdays" | undefined,
          source: "user",
        },
      }),
    onSuccess: () => {
      setText("");
      setPreview(null);
      haptic("success");
      toast("Напоминание сохранено. Пришлём в Telegram.");
      void qc.invalidateQueries({ queryKey: ["reminders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => reminderDelete({ data: { token, id } }),
    onSuccess: () => {
      haptic("heavy");
      void qc.invalidateQueries({ queryKey: ["reminders"] });
    },
  });

  const upcoming = (list.data ?? []).filter((r) => new Date(r.due_at).getTime() >= Date.now() - 60_000).slice(0, 6);

  return (
    <FoldCard
      icon={<Bell className="size-4" />}
      title="Напоминания"
      status={upcoming.length ? `${upcoming.length} активных` : "голосом или текстом"}
    >
      <div className="space-y-2 px-3 pb-3">
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPreview(null);
            }}
            placeholder="Завтра в 9 забрать посылку"
            onKeyDown={(e) => {
              if (e.key === "Enter") void previewMut.mutate();
            }}
          />
          <Button
            variant="secondary"
            size="icon"
            aria-label="Диктовка"
            onClick={() => {
              void listenOnce()
                .then((t) => {
                  setText(t);
                  setPreview(null);
                })
                .catch((e: Error) => toast.error(e.message));
            }}
          >
            <Mic className="size-4" />
          </Button>
        </div>
        {preview ? (
          <Card className="space-y-2 p-3">
            <div className="text-sm font-semibold">{preview.text}</div>
            <div className="text-xs text-muted-foreground">
              {stamp(preview.dueAt)} · {recurrenceLabel(preview.recurrence as "none")}
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" size="sm" onClick={() => void save.mutate()}>
                Подтвердить
              </Button>
              <Button
                className="flex-1"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setPreview(null);
                }}
              >
                Изменить
              </Button>
            </div>
          </Card>
        ) : (
          <Button
            variant="secondary"
            className="w-full"
            disabled={text.trim().length < 2 || previewMut.isPending}
            onClick={() => void previewMut.mutate()}
          >
            Разобрать
          </Button>
        )}
        {upcoming.map((r) => (
          <div key={r.id} className="flex items-start justify-between gap-2 rounded-2xl bg-muted px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-snug">{r.text}</div>
              <div className="text-[11px] text-muted-foreground">
                {stamp(r.due_at)} · {r.source === "agent" ? "агент" : r.owner_name || "вы"} ·{" "}
                {recurrenceLabel(r.recurrence)}
              </div>
            </div>
            <button
              type="button"
              className="mt-0.5 text-muted-foreground"
              aria-label="Удалить"
              onClick={() => void remove.mutate(r.id)}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </FoldCard>
  );
}
