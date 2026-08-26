import { useState } from "react";
import { Inbox, Mic, Plus, SquareCheckBig, Users, X } from "lucide-react";
import { useInbox } from "@/lib/stores/inbox";
import { useTasks } from "@/lib/stores/tasks";
import { useHub } from "@/lib/stores/hub";
import { useSettings } from "@/lib/stores/settings";
import { hubShareDelete, hubShareUpsert } from "@/lib/server/hub-share";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FoldCard } from "@/components/home/fold-card";
import { startDictation } from "@/lib/voice";
import { haptic } from "@/lib/haptic";

export function InboxCard() {
  const notes = useInbox((s) => s.notes);
  const add = useInbox((s) => s.add);
  const remove = useInbox((s) => s.remove);
  const addTask = useTasks((s) => s.add);
  const token = useHub((s) => s.token);
  const name = useHub((s) => s.user?.displayName);
  const family = useSettings((s) => s.familyShare);
  const [value, setValue] = useState("");
  const [share, setShare] = useState(false);
  const [voiceError, setVoiceError] = useState("");

  const submit = (text?: string) => {
    const note = add({
      text: text ?? value,
      shared: family && share,
      ownerName: name,
    });
    setValue("");
    if (!note) return;
    haptic("medium");
    if (note.shared && token) {
      void hubShareUpsert({ data: { token, kind: "note", payload: note } });
    }
  };

  const toTask = (id: string) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    const taskId = addTask({
      text: note.text,
      shared: Boolean(note.shared),
      ownerName: note.ownerName ?? name,
    });
    remove(id);
    haptic("medium");
    if (note.shared && token) {
      void hubShareDelete({ data: { token, id } });
      const task = useTasks.getState().tasks.find((t) => t.id === taskId);
      if (task) void hubShareUpsert({ data: { token, kind: "task", payload: task } });
    }
  };

  return (
    <FoldCard
      icon={<Inbox className="size-4" />}
      title="Inbox"
      status={notes.length ? `${notes.length} заметок` : "сброс мыслей"}
    >
      {notes.slice(0, 5).map((n) => (
        <div key={n.id} className="flex items-start gap-1.5 rounded-2xl bg-muted px-3 py-2">
          <div className="min-w-0 flex-1 text-sm leading-snug">
            {n.text}
            {n.shared ? (
              <div className="mt-0.5 text-xs text-muted-foreground">семья{n.ownerName ? ` · ${n.ownerName}` : ""}</div>
            ) : null}
          </div>
          <button
            type="button"
            className="grid size-8 place-items-center text-muted-foreground"
            aria-label="Сделать задачей"
            onClick={() => toTask(n.id)}
          >
            <SquareCheckBig className="size-4" />
          </button>
          <button
            type="button"
            className="grid size-8 place-items-center text-muted-foreground"
            aria-label="Удалить"
            onClick={() => {
              remove(n.id);
              if (n.shared && token) void hubShareDelete({ data: { token, id: n.id } });
            }}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <div className="flex min-w-0 items-center gap-1.5 pt-1">
        <Input
          placeholder="Мысль, ссылка, черновик…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className="min-w-0 flex-1"
        />
        {family ? (
          <Button
            type="button"
            variant={share ? "default" : "secondary"}
            size="icon"
            aria-label="Семья"
            onClick={() => setShare((v) => !v)}
          >
            <Users className="size-4" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Голос"
          onClick={() =>
            startDictation(
              (t) => submit(t),
              (msg) => {
                setVoiceError(msg);
                setTimeout(() => setVoiceError(""), 2200);
              },
            )
          }
        >
          <Mic className="size-4" />
        </Button>
        <Button type="button" variant="solid" size="icon" aria-label="Добавить" onClick={() => submit()}>
          <Plus className="size-4" />
        </Button>
      </div>
      {voiceError ? <div className="text-xs font-semibold text-destructive">{voiceError}</div> : null}
    </FoldCard>
  );
}
