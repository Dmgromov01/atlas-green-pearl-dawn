import { useState } from "react";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { hubSetPin } from "@/lib/server/hub-auth";
import { hubPasskeyDelete, hubPasskeyFinishRegister, hubPasskeyList, hubPasskeyStartRegister } from "@/lib/server/webauthn";
import { useHub } from "@/lib/stores/hub";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionLabel } from "@/components/shell/page";
import { haptic } from "@/lib/haptic";

export function PasskeysCard() {
  const token = useHub((s) => s.token);
  const user = useHub((s) => s.user);
  const setSession = useHub((s) => s.setSession);
  const qc = useQueryClient();
  const [pin, setPin] = useState("");
  const passkeyOk = typeof window !== "undefined" && browserSupportsWebAuthn();

  const keys = useQuery({
    queryKey: ["passkeys"],
    queryFn: () => hubPasskeyList({ data: { token } }),
    enabled: Boolean(token),
  });

  const addKey = useMutation({
    mutationFn: async () => {
      const options = await hubPasskeyStartRegister({ data: { token } });
      const cred = await startRegistration({ optionsJSON: options });
      return hubPasskeyFinishRegister({ data: { token, response: cred, label: "Face ID" } });
    },
    onSuccess: (res) => {
      setSession(res.token, res.user);
      haptic("success");
      toast("Face ID привязан. Старые сессии закрыты.");
      void qc.invalidateQueries({ queryKey: ["passkeys"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dropKey = useMutation({
    mutationFn: (id: string) => hubPasskeyDelete({ data: { token, id } }),
    onSuccess: (res) => {
      if (user) setSession(res.token, { ...user, hasPasskey: res.hasPasskey });
      haptic("heavy");
      void qc.invalidateQueries({ queryKey: ["passkeys"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="space-y-3 p-4">
      <SectionLabel>Вход</SectionLabel>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Face ID — основной. PIN — запасной. Смена PIN или перепривязка Face ID закрывает все сессии.
      </p>
      {passkeyOk ? (
        <Button variant="secondary" className="w-full" onClick={() => void addKey.mutate()}>
          Привязать Face ID
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Этот браузер без Face ID.</p>
      )}
      {(keys.data ?? []).map((k) => (
        <div key={k.id} className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate">{k.label || "Face ID"} · {k.created_at.slice(0, 10)}</span>
          <Button variant="ghost" size="sm" onClick={() => void dropKey.mutate(k.id)}>
            Отвязать
          </Button>
        </div>
      ))}
      <Input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
        placeholder="Новый PIN, 4–8 цифр"
      />
      <Button
        className="w-full"
        disabled={pin.length < 4}
        onClick={async () => {
          try {
            const res = await hubSetPin({ data: { token, pin } });
            if (user) setSession(res.token, res.user);
            setPin("");
            haptic("success");
            toast("PIN обновлён. Старые сессии закрыты.");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "PIN не сохранился");
          }
        }}
      >
        Сменить PIN
      </Button>
    </Card>
  );
}
