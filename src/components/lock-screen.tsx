import { useState } from "react";
import { useSettings, verifyPin } from "@/lib/stores/settings";
import { unlockSession } from "@/lib/pin-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { haptic } from "@/lib/haptic";
import { APP_NAME } from "@/lib/brand";
import { BrandMark } from "@/components/brand-mark";

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const pinSalt = useSettings((s) => s.pinSalt);
  const pinHash = useSettings((s) => s.pinHash);
  const name = useSettings((s) => s.displayName);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!pinSalt || !pinHash) {
      onUnlock();
      return;
    }
    setBusy(true);
    setErr("");
    const ok = await verifyPin(pin, pinSalt, pinHash);
    setBusy(false);
    if (!ok) {
      haptic("heavy");
      setErr("Неверный код");
      setPin("");
      return;
    }
    unlockSession();
    haptic("success");
    onUnlock();
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <BrandMark size={56} className="mx-auto" />
      <p className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{APP_NAME}</p>
      <h1 className="mt-2 text-center text-3xl font-semibold tracking-tight">Здравствуйте{name ? `, ${name}` : ""}</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">Введите код доступа к хабу.</p>
      <Input
        className="mt-6"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
        placeholder="Код"
        autoFocus
      />
      {err ? <p className="mt-2 text-sm text-destructive">{err}</p> : null}
      <Button className="mt-4 h-12 w-full" disabled={busy || pin.length < 4} onClick={() => void submit()}>
        Открыть
      </Button>
    </div>
  );
}
