import { type ReactNode } from "react";
import { useHub } from "@/lib/stores/hub";
import { LoginScreen } from "@/components/auth/login-screen";
import { SetupOwner } from "@/components/auth/setup-owner";
import { BindPasskey } from "@/components/auth/bind-passkey";

export function Gate({ children }: { children: ReactNode }) {
  const ready = useHub((s) => s.ready);
  const needsSetup = useHub((s) => s.needsSetup);
  const user = useHub((s) => s.user);
  const token = useHub((s) => s.token);

  if (!ready) {
    return <div className="min-h-dvh bg-background" />;
  }
  if (!user || !token) {
    if (needsSetup) return <SetupOwner />;
    return <LoginScreen />;
  }
  if (!user.hasPasskey) return <BindPasskey />;
  return children;
}
