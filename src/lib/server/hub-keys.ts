import { createServerFn } from "@tanstack/react-start";
import type { AiMode, ByokProvider } from "@/lib/hub/identity";

export const hubSaveKey = createServerFn({ method: "POST" })
  .validator(
    (data: {
      token: string;
      provider: ByokProvider;
      apiKey: string;
      baseUrl?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { saveKeyHub } = await import("./hub-keys.server");
    return saveKeyHub(data);
  });

export const hubClearKey = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const { clearKeyHub } = await import("./hub-keys.server");
    return clearKeyHub(data.token);
  });

export const hubSetAiMode = createServerFn({ method: "POST" })
  .validator((data: { token: string; mode: AiMode }) => data)
  .handler(async ({ data }) => {
    const { setAiModeHub } = await import("./hub-keys.server");
    return setAiModeHub(data.token, data.mode);
  });
