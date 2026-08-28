import { useState } from "react";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { hubPasskeyFinishRegister, hubPasskeyStartRegister } from "@/lib/server/webauthn";
import { useHub } from "@/lib/stores/hub";
import { useSettings } from "@/lib/stores/settings";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { haptic } from "@/lib/haptic";

export function BindPasskey() {
  const token = useHub((s) => s.token);
  const setSession = useHub((s) => s.setSession);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const passkeyOk = typeof window !== "undefined" && browserSupportsWebAuthn();

  const bind = async () => {
    setBusy(true);
    setErr("");
    try {
      const options = await hubPasskeyStartRegister({ data: { token } });
      const cred = await startRegistration({ optionsJSON: options });
      const res = await hubPasskeyFinishRegister({
        data: { token, response: cred, label: "Face ID" },
      });
      setSession(res.token, res.user);
      useSettings.getState().completeOnboarding(res.user.displayName);
      haptic("success");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Face ID не привязался");
      haptic("heavy");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <BrandMark size={56} className="mx-auto" />
      <h1 className="mt-4 text-center text-2xl font-semibold tracking-tight">Face ID</h1>
      <p className="mt-2 text-center text-base leading-relaxed text-muted-foreground">
        Основной вход. PIN останется запасным.
      </p>
      {err ? <p className="mt-3 text-center text-sm text-destructive">{err}</p> : null}
      {passkeyOk ? (
        <Button className="mt-6 h-12 w-full" disabled={busy} onClick={() => void bind()}>
          Включить Face ID
        </Button>
      ) : (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Нужен Safari или Chrome с Face ID, Touch ID или Windows Hello.
        </p>
      )}
    </div>
  );
}
