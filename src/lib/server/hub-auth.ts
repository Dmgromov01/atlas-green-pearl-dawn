import { createServerFn } from "@tanstack/react-start";
import type { HubUserPublic } from "@/lib/hub/identity";

export const hubLogin = createServerFn({ method: "POST" })
  .validator(
    (data: {
      initData?: string;
      pin?: string;
      deviceId?: string;
      displayName?: string;
      biometric?: boolean;
    }) => data,
  )
  .handler(async ({ data }): Promise<{ token: string; expiresAt: string; user: HubUserPublic } | { error: string }> => {
    const { loginHub } = await import("./hub-auth.server");
    return loginHub(data);
  });

export const hubMe = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const { meHub } = await import("./hub-auth.server");
    return meHub(data.token);
  });

export const hubLogout = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const { logoutHub } = await import("./hub-auth.server");
    return logoutHub(data.token);
  });

export const hubSetPin = createServerFn({ method: "POST" })
  .validator((data: { token: string; pin: string }) => data)
  .handler(async ({ data }) => {
    const { setPinHub } = await import("./hub-auth.server");
    return setPinHub(data.token, data.pin);
  });

export const hubClearPin = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const { clearPinHub } = await import("./hub-auth.server");
    return clearPinHub(data.token);
  });
