import { useState } from "react";
import { hubSetupOwner } from "@/lib/server/hub-auth";
import { useHub } from "@/lib/stores/hub";
import { useSettings } from "@/lib/stores/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/brand-mark";
import { APP_NAME } from "@/lib/brand";
import { haptic } from "@/lib/haptic";

export function SetupOwner() {
  const setSession = useHub((s) => s.setSession);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pin !== pin2) {
      setErr("PIN не совпадает");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await hubSetupOwner({ data: { displayName: name, pin } });
      if ("error" in res) {
        setErr(res.error);
        haptic("heavy");
        return;
      }
      setSession(res.token, res.user);
      useSettings.getState().completeOnboarding(res.user.displayName);
      haptic("success");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось создать владельца");
      haptic("heavy");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <BrandMark size={56} className="mx-auto" />
      <h1 className="mt-4 text-center text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
      <p className="mt-2 text-center text-base leading-relaxed text-muted-foreground">
        Первый вход. Вы становитесь владельцем: Face ID — основной, PIN — запасной. Семья заходит только по инвайту.
      </p>
      <label className="mt-6 text-sm font-semibold text-muted-foreground" htmlFor="owner-name">
        Имя
      </label>
      <Input
        id="owner-name"
        className="mt-1"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Дмитрий"
        autoFocus
        autoComplete="nickname"
      />
      <label className="mt-4 text-sm font-semibold text-muted-foreground" htmlFor="owner-pin">
        PIN, 4–8 цифр
      </label>
      <Input
        id="owner-pin"
        className="mt-1"
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
        placeholder="Запасной код"
      />
      <Input
        className="mt-2"
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        value={pin2}
        onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 8))}
        placeholder="Повторите PIN"
      />
      {err ? <p className="mt-2 text-sm text-destructive">{err}</p> : null}
      <Button className="mt-6 h-12 w-full" disabled={busy || name.trim().length < 2 || pin.length < 4} type="submit">
        Дальше — Face ID
      </Button>
    </form>
  );
}
