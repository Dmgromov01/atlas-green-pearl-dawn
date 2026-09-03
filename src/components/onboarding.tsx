import { useState } from "react";
import { useSettings } from "@/lib/stores/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { haptic } from "@/lib/haptic";
import { APP_NAME } from "@/lib/brand";
import { BrandMark } from "@/components/brand-mark";

export function Onboarding() {
  const completeOnboarding = useSettings((s) => s.completeOnboarding);
  const [name, setName] = useState("");

  const finish = () => {
    const n = name.trim().slice(0, 40) || "Гость";
    completeOnboarding(n);
    try {
      haptic("success");
    } catch {
      /* ignore */
    }
  };

  return (
    <form
      className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-8"
      onSubmit={(e) => {
        e.preventDefault();
        finish();
      }}
    >
      <BrandMark size={56} className="mx-auto" />
      <h1 className="mt-3 text-center text-xl font-semibold tracking-tight text-foreground">{APP_NAME}</h1>
      <p className="mx-auto mt-1 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
        Погода, задачи, дайджест и переводчик.
      </p>
      <label className="mt-8 block text-sm font-semibold text-muted-foreground" htmlFor="onboard-name">
        Как к вам обращаться
      </label>
      <Input
        id="onboard-name"
        name="displayName"
        className="mt-2"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Имя"
        autoFocus
        autoComplete="nickname"
      />
      <Button type="submit" className="mt-6 h-12 w-full">
        Продолжить
      </Button>
    </form>
  );
}
