import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { hubClearKey, hubSaveKey, hubSetAiMode } from "@/lib/server/hub-keys";
import { hubAiProbe } from "@/lib/server/openclaw";
import { useHub } from "@/lib/stores/hub";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionLabel } from "@/components/shell/page";
import { haptic } from "@/lib/haptic";
import type { AiMode, ByokProvider } from "@/lib/hub/identity";

const PROVIDERS: { id: ByokProvider; label: string }[] = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "openclaw", label: "OpenClaw" },
  { id: "custom", label: "Свой шлюз" },
];

export function AiAccessCard() {
  const token = useHub((s) => s.token);
  const user = useHub((s) => s.user);
  const loginError = useHub((s) => s.loginError);
  const setSession = useHub((s) => s.setSession);
  const [provider, setProvider] = useState<ByokProvider>(user?.byokProvider || "openai");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  const save = useMutation({
    mutationFn: () =>
      hubSaveKey({ data: { token, provider, apiKey, baseUrl: baseUrl || undefined } }),
    onSuccess: (res) => {
      if (!user) return;
      setSession(token, { ...user, aiMode: "byok", byokHint: res.hint, byokProvider: provider });
      setApiKey("");
      haptic("success");
      toast("Ключ сохранён (AES-256-GCM)");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mode = useMutation({
    mutationFn: (next: AiMode) => hubSetAiMode({ data: { token, mode: next } }),
    onSuccess: (_r, next) => {
      if (!user) return;
      setSession(token, { ...user, aiMode: next });
      haptic();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const probe = useMutation({
    mutationFn: () => hubAiProbe({ data: { token } }),
    onSuccess: (r) => toast(`Шлюз отвечает · ${r.provider || r.source}`),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!token || !user) {
    return (
      <Card className="space-y-2 p-4">
        <SectionLabel>AI-доступ</SectionLabel>
        <p className="text-sm text-muted-foreground">
          {loginError || "Сессия ещё не установлена. Откройте приложение заново."}
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-3 p-4">
      <SectionLabel>AI-доступ</SectionLabel>
      <p className="text-sm leading-snug text-muted-foreground">
        Общий пул — шлюз OpenClaw на мини-ПК. Свой ключ шифруется на сервере (AES-256-GCM).
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {(["off", "byok", "shared"] as const).map((m) => (
          <button
            key={m}
            type="button"
            disabled={m === "shared" && !user.allowGlobalAi}
            onClick={() => mode.mutate(m)}
            className={`h-9 rounded-full text-xs font-bold ${
              user.aiMode === m ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {m === "off" ? "Выкл" : m === "byok" ? "Мой ключ" : "Общий пул"}
          </button>
        ))}
      </div>
      {!user.allowGlobalAi ? (
        <p className="text-[11px] text-muted-foreground">Общий пул для вас выключен.</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Квота {user.quotaUsed}/{user.quotaDaily} запросов сегодня.
        </p>
      )}
      <div className="flex flex-wrap gap-1">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setProvider(p.id)}
            className={`h-8 rounded-full px-3 text-[11px] font-bold ${
              provider === p.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {provider === "custom" ? (
        <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://gateway.example.com" />
      ) : null}
      <Input
        type="password"
        autoComplete="off"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder={user.byokHint ? `Заменить ${user.byokHint}` : "sk-… или ключ шлюза"}
      />
      <div className="flex gap-2">
        <Button className="flex-1" disabled={apiKey.length < 12 || save.isPending} onClick={() => save.mutate()}>
          Сохранить ключ
        </Button>
        {user.byokHint ? (
          <Button
            variant="outline"
            onClick={async () => {
              await hubClearKey({ data: { token } });
              setSession(token, { ...user, byokHint: null, byokProvider: null, aiMode: user.allowGlobalAi ? "shared" : "off" });
              toast("Ключ удалён");
            }}
          >
            Снять
          </Button>
        ) : null}
      </div>
      <Button variant="secondary" className="w-full" disabled={probe.isPending || user.aiMode === "off"} onClick={() => probe.mutate()}>
        Проверить агента
      </Button>
    </Card>
  );
}
