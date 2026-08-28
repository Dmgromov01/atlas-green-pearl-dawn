import { createServerFn } from "@tanstack/react-start";
import type { HubUserPublic } from "@/lib/hub/identity";

type SessionOk = { token: string; expiresAt: string; user: HubUserPublic };
type SessionOrError = SessionOk | { error: string };

export const hubStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { hubAuthStatus } = await import("./hub-auth.server");
  return hubAuthStatus();
});

export const hubLogin = createServerFn({ method: "POST" })
  .validator(
    (data: {
      initData?: string;
      pin?: string;
      hintUserId?: string;
      displayName?: string;
      biometric?: boolean;
    }) => data,
  )
  .handler(async ({ data }): Promise<SessionOrError> => {
    const { loginHub } = await import("./hub-auth.server");
    return loginHub(data);
  });

export const hubSetupOwner = createServerFn({ method: "POST" })
  .validator((data: { displayName: string; pin: string }) => data)
  .handler(async ({ data }): Promise<SessionOrError> => {
    const { setupOwnerHub } = await import("./hub-auth.server");
    return setupOwnerHub(data);
  });

export const hubMe = createServerFn({ method: "POST" })
  .validator((data?: { token?: string }) => data ?? {})
  .handler(async ({ data }) => {
    const { meHub } = await import("./hub-auth.server");
    return meHub(data.token);
  });

export const hubLogout = createServerFn({ method: "POST" })
  .validator((data?: { token?: string }) => data ?? {})
  .handler(async ({ data }) => {
    const { logoutHub } = await import("./hub-auth.server");
    return logoutHub(data.token);
  });

export const hubSetPin = createServerFn({ method: "POST" })
  .validator((data: { token?: string; pin: string }) => data)
  .handler(async ({ data }) => {
    const { setPinHub } = await import("./hub-auth.server");
    return setPinHub(data.token, data.pin);
  });

export const hubClearPin = createServerFn({ method: "POST" })
  .validator((data?: { token?: string }) => data ?? {})
  .handler(async ({ data }) => {
    const { clearPinHub } = await import("./hub-auth.server");
    return clearPinHub(data.token);
  });

export const hubCreateInvite = createServerFn({ method: "POST" })
  .validator((data: { token?: string; displayName?: string }) => data)
  .handler(async ({ data }) => {
    const { createInviteHub } = await import("./hub-auth.server");
    return createInviteHub(data.token ?? "", { displayName: data.displayName });
  });

export const hubListInvites = createServerFn({ method: "POST" })
  .validator((data?: { token?: string }) => data ?? {})
  .handler(async ({ data }) => {
    const { listInvitesHub } = await import("./hub-auth.server");
    return listInvitesHub(data.token);
  });

export const hubRedeemInvite = createServerFn({ method: "POST" })
  .validator((data: { invite: string; displayName: string; pin: string }) => data)
  .handler(async ({ data }): Promise<SessionOrError> => {
    const { redeemInviteHub } = await import("./hub-auth.server");
    return redeemInviteHub(data);
  });
