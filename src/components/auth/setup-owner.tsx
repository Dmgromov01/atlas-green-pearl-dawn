import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { hubSetupOwner } from "@/lib/server/hub-auth";
import { hubPasskeyFinishRegister, hubPasskeyStartRegister } from "@/lib/server/webauthn";
import { useHub } from "@/lib/stores/hub";
import { useSettings } from "@/lib/stores/settings";
import type { HubUserPublic } from "@/lib/hub/identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/brand-mark";
import { APP_NAME } from "@/lib/brand";
import { haptic } from "@/lib/haptic";

type Pending = { token: string; user: HubUserPublic };

export function SetupOwner() {
  const setSession = useHub((s) => s.setSession);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const enter = (session: Pending) => {
    setSession(session.token, session.user);
    useSettings.getState().completeOnboarding(session.user.displayName);
    haptic("success");
  };

  const finishPasskey = async () => {
    if (!pending) return;
    setBusy(true);
    setErr("");
    try {
      const options = await hubPasskeyStartRegister({ data: { token: pending.token } });
      const cred = await startRegistration({ optionsJSON: options });
      const res = await hubPasskeyFinishRegister({
        data: { token: pending.token, response: cred, label: "Face ID" },
      });
      enter({ token: res.token, user: res.user });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Face ID не привязался. Можно позже в настройках.");
      haptic("heavy");
    } finally {
      setBusy(false);
    }
  };

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
      setPending({ token: res.token, user: res.user });
      haptic("success");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось создать владельца");
    } finally {
      setBusy(false);
    }
  };

  if (pending) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
        <BrandMark size={56} className="mx-auto" />
        <h1 className="mt-4 text-center text-2xl font-semibold tracking-tight">Владелец назначен</h1>
        <p className="mt-2 text-center text-base text-muted-foreground">
          Привяжите Face ID — основной вход. PIN останется запасным.
        </p>
        {err ? <p className="mt-3 text-center text-sm text-destructive">{err}</p> : null}
        <Button className="mt-6 h-12 w-full" disabled={busy} onClick={() => void finishPasskey()}>
          Включить Face ID
        </Button>
        <Button className="mt-2 h-12 w-full" variant="secondary" disabled={busy} onClick={() => enter(pending)}>
          Позже
        </Button>
      </div>
    );
  }

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
        Первый вход. Вы становитесь владельцем. Семья заходит только по инвайту, общего пароля нет.
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
        Стать владельцем
      </Button>
    </form>
  );
}
