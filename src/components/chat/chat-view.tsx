import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Mic, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { hubAiChat } from "@/lib/server/openclaw";
import { applyHubActions, splitHubReply } from "@/lib/hub/actions";
import { useChat } from "@/lib/stores/chat";
import { useHub } from "@/lib/stores/hub";
import { useTasks } from "@/lib/stores/tasks";
import { useCalendar } from "@/lib/stores/calendar";
import { useInbox } from "@/lib/stores/inbox";
import { useSettings } from "@/lib/stores/settings";
import { AppShell } from "@/components/shell/app-shell";
import { Header } from "@/components/shell/header";
import { Page } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { startDictation } from "@/lib/voice";
import { haptic } from "@/lib/haptic";
import { cn, formatDue, formatTime, localDateKey } from "@/lib/utils";

function dayContext() {
  const settings = useSettings.getState();
  const name = settings.displayName;
  const city = settings.city;
  const now = new Date();
  const tasks = useTasks
    .getState()
    .tasks.filter((t) => !t.done)
    .slice(0, 6)
    .map((t) => `${t.text}${t.dueAt ? ` (${formatDue(t.dueAt)})` : ""}`);
  const today = localDateKey(now);
  const events = useCalendar
    .getState()
    .events.filter((e) => localDateKey(e.start) === today)
    .slice(0, 6)
    .map((e) => `${e.summary} ${formatTime(new Date(e.start))}`);
  const notes = useInbox
    .getState()
    .notes.slice(0, 5)
    .map((n) => n.text);
  return [
    `Сейчас: ${today} ${formatTime(now)}${city ? ` (${city.tz})` : ""}`,
    name ? `Пользователь: ${name}` : "",
    city ? `Город: ${city.name}` : "",
    tasks.length ? `Задачи: ${tasks.join("; ")}` : "Открытых задач нет",
    events.length ? `События сегодня: ${events.join("; ")}` : "Событий сегодня нет",
    notes.length ? `Inbox: ${notes.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function ChatView() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/chat" });
  const token = useHub((s) => s.token);
  const user = useHub((s) => s.user);
  const family = useSettings((s) => s.familyShare);
  const messages = useChat((s) => s.messages);
  const push = useChat((s) => s.push);
  const popLastUser = useChat((s) => s.popLastUser);
  const reset = useChat((s) => s.reset);
  const [text, setText] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const asked = useRef<string | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const send = useMutation({
    mutationFn: async (payload: string) => {
      if (!token) throw new Error("Нет сессии. Откройте хаб заново.");
      if (user?.aiMode === "off") throw new Error("Агент выключен. Включите AI в Настройках.");
      push("user", payload);
      const history = [...useChat.getState().messages].map((m) => ({
        role: m.role,
        text: m.text,
      }));
      return hubAiChat({ data: { token, messages: history, context: dayContext() } });
    },
    onSuccess: async (res) => {
      const { text: reply, actions, fenced } = splitHubReply(res.text || "");
      const labels = await applyHubActions(actions, {
        token,
        name: user?.displayName,
        family,
      });
      if (fenced && !actions.length) {
        toast.error("Не смог разобрать действие агента");
      }
      const suffix = labels.length ? `\n\nДобавил: ${labels.join("; ")}.` : "";
      push("assistant", (reply || (labels.length ? "Готово." : "Пустой ответ.")) + suffix);
      haptic("success");
    },
    onError: (e: Error) => {
      popLastUser();
      toast.error(e.message);
    },
  });

  const submit = (raw?: string) => {
    const payload = (raw ?? text).trim();
    if (!payload || send.isPending || user?.aiMode === "off") return;
    setText("");
    haptic("medium");
    send.mutate(payload);
  };

  useEffect(() => {
    const q = search.q?.trim();
    if (!q || !token || asked.current === q) return;
    asked.current = q;
    void navigate({ to: "/chat", search: { q: undefined }, replace: true });
    submit(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per q
  }, [search.q, token]);

  const aiOff = user?.aiMode === "off";
  const agentLabel =
    aiOff
      ? "включите AI в настройках"
      : user?.aiMode === "byok" && user.byokProvider === "openai"
        ? "OpenAI"
        : user?.aiMode === "byok" && user.byokProvider === "anthropic"
          ? "Anthropic"
          : user?.aiMode === "byok" && user.byokProvider === "custom"
            ? "свой шлюз"
            : "OpenClaw";

  return (
    <AppShell>
      <Header
        title="Агент"
        subtitle={agentLabel}
        backTo="/"
        right={
          messages.length ? (
            <Button variant="secondary" size="icon-sm" aria-label="Очистить чат" onClick={() => reset()}>
              <Trash2 className="size-4" />
            </Button>
          ) : undefined
        }
      />
      <Page className="min-h-0 flex-1">
        <div className="flex min-h-[60dvh] flex-col">
          <div className="flex-1 space-y-2">
            {messages.length === 0 ? (
              <div className="rounded-lg border border-border bg-card px-4 py-6 text-center">
                <p className="text-sm font-semibold">Спросите агента</p>
                {aiOff ? (
                  <>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Агент выключен. В Настройках включите общий пул OpenClaw или сохраните свой ключ.
                    </p>
                    <Button className="mt-3" variant="secondary" onClick={() => navigate({ to: "/settings" })}>
                      Открыть настройки
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Видит задачи, события и Inbox. Может добавить дело или встречу по просьбе.
                    </p>
                    <div className="mt-3 flex flex-col gap-1.5">
                      {["Что у меня сегодня?", "Добавь задачу: купить молоко вечером", "Разложи задачи по приоритету"].map(
                        (q) => (
                          <button
                            key={q}
                            type="button"
                            className="rounded-md bg-muted px-3 py-2 text-sm"
                            onClick={() => submit(q)}
                          >
                            {q}
                          </button>
                        ),
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[92%] rounded-lg px-3.5 py-2.5 text-sm leading-snug whitespace-pre-wrap",
                    m.role === "user" ? "ml-auto bg-foreground text-background" : "bg-card text-foreground",
                  )}
                >
                  {m.text}
                </div>
              ))
            )}
            {send.isPending ? (
              <div className="w-fit rounded-lg bg-card px-3.5 py-2.5 text-xs text-muted-foreground">Думает…</div>
            ) : null}
            <div ref={endRef} />
          </div>
          <div className="sticky bottom-2 mt-3 flex items-center gap-1.5">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={aiOff ? "Сначала включите AI в Настройках" : "Сообщение агенту…"}
              disabled={aiOff || send.isPending}
              className="flex h-10 min-w-0 flex-1 rounded-md border border-border bg-card px-3.5 text-sm outline-none disabled:opacity-60"
            />
            <Button
              variant="secondary"
              size="icon"
              aria-label="Голос"
              disabled={aiOff || send.isPending}
              onClick={() => {
                startDictation(
                  (t) => submit(t),
                  (msg) => {
                    setVoiceError(msg);
                    setTimeout(() => setVoiceError(""), 2200);
                  },
                );
              }}
            >
              <Mic className="size-4" />
            </Button>
            <Button
              variant="solid"
              size="icon"
              aria-label="Отправить"
              disabled={aiOff || send.isPending}
              onClick={() => submit()}
            >
              <Send className="size-4" />
            </Button>
          </div>
          {voiceError ? <div className="text-xs font-semibold text-destructive">{voiceError}</div> : null}
        </div>
      </Page>
    </AppShell>
  );
}
