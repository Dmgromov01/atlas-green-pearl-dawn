import { useMemo, useState } from "react";
import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { hubLogin, hubRedeemInvite } from "@/lib/server/hub-auth";
import { hubPasskeyFinishLogin, hubPasskeyStartLogin } from "@/lib/server/webauthn";
import { useHub } from "@/lib/stores/hub";
import { useSettings } from "@/lib/stores/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/brand-mark";
import { APP_NAME } from "@/lib/brand";
import { haptic } from "@/lib/haptic";

function inviteFromUrl() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("invite") || "";
}

export function LoginScreen() {
  const setSession = useHub((s) => s.setSession);
  const cached = useHub((s) => s.user);
  const loginError = useHub((s) => s.loginError);
  const inviteToken = useMemo(inviteFromUrl, []);
  const [mode, setMode] = useState<"in" | "invite">(inviteToken ? "invite" : "in");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [invite, setInvite] = useState(inviteToken);
  const [err, setErr] = useState(loginError || "");
  const [busy, setBusy] = useState(false);
  const passkeyOk = typeof window !== "undefined" && browserSupportsWebAuthn();

  const applySession = (token: string, user: { displayName: string } & Parameters<typeof setSession>[1]) => {
    setSession(token, user);
    useSettings.getState().completeOnboarding(user.displayName);
    haptic("success");
  };

  const faceId = async () => {
    setBusy(true);
    setErr("");
    try {
      const options = await hubPasskeyStartLogin();
      const cred = await startAuthentication({ optionsJSON: options });
      const res = await hubPasskeyFinishLogin({ data: { response: cred } });
      applySession(res.token, res.user);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Face ID не сработал");
      haptic("heavy");
    } finally {
      setBusy(false);
    }
  };

  const pinIn = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await hubLogin({
        data: { pin, hintUserId: cached?.id },
      });
      if ("error" in res) {
        setErr(res.error);
        haptic("heavy");
        return;
      }
      applySession(res.token, res.user);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось войти");
    } finally {
      setBusy(false);
    }
  };

  const redeem = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await hubRedeemInvite({ data: { invite: invite.trim(), displayName: name, pin } });
      if ("error" in res) {
        setErr(res.error);
        haptic("heavy");
        return;
      }
      applySession(res.token, res.user);
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("invite");
        window.history.replaceState({}, "", url.pathname);
      } catch {
        /* ignore */
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Инвайт не принят");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <BrandMark size={56} className="mx-auto" />
      <h1 className="mt-4 text-center text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
      <p className="mt-2 text-center text-base text-muted-foreground">
        {mode === "invite" ? "Вход по семейному инвайту" : "Face ID — основной вход, PIN — запасной"}
      </p>

      {mode === "in" ? (
        <>
          {passkeyOk ? (
            <Button className="mt-8 h-12 w-full" disabled={busy} onClick={() => void faceId()}>
              Войти с Face ID
            </Button>
          ) : (
            <p className="mt-8 text-center text-sm text-muted-foreground">Этот браузер без Passkey — используйте PIN.</p>
          )}
          <Input
            className="mt-6"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void pinIn();
            }}
            placeholder="PIN"
          />
          <Button className="mt-3 h-12 w-full" variant="secondary" disabled={busy || pin.length < 4} onClick={() => void pinIn()}>
            Войти по PIN
          </Button>
          <button
            type="button"
            className="mt-5 text-center text-sm font-semibold text-accent"
            onClick={() => setMode("invite")}
          >
            У меня есть инвайт
          </button>
        </>
      ) : (
        <>
          <Input
            className="mt-8"
            value={invite}
            onChange={(e) => setInvite(e.target.value.trim())}
            placeholder="Код инвайта"
            autoComplete="off"
          />
          <Input
            className="mt-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ваше имя"
            autoComplete="nickname"
          />
          <Input
            className="mt-2"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="Свой PIN, 4–8 цифр"
          />
          <Button
            className="mt-4 h-12 w-full"
            disabled={busy || invite.length < 8 || name.trim().length < 2 || pin.length < 4}
            onClick={() => void redeem()}
          >
            Присоединиться
          </Button>
          <button type="button" className="mt-5 text-center text-sm font-semibold text-accent" onClick={() => setMode("in")}>
            Уже есть аккаунт
          </button>
        </>
      )}
      {err ? <p className="mt-4 text-center text-sm text-destructive">{err}</p> : null}
    </div>
  );
}
