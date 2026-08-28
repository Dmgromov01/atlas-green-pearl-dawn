import { createServerFn } from "@tanstack/react-start";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";

export const hubPasskeyStartRegister = createServerFn({ method: "POST" })
  .validator((data?: { token?: string }) => data ?? {})
  .handler(async ({ data }): Promise<PublicKeyCredentialCreationOptionsJSON> => {
    const { startRegisterPasskey } = await import("./webauthn.server");
    return startRegisterPasskey(data.token);
  });

export const hubPasskeyFinishRegister = createServerFn({ method: "POST" })
  .validator((data: { token?: string; response: RegistrationResponseJSON; label?: string }) => data)
  .handler(async ({ data }) => {
    const { finishRegisterPasskey } = await import("./webauthn.server");
    return finishRegisterPasskey(data.token, data.response, data.label);
  });

export const hubPasskeyStartLogin = createServerFn({ method: "POST" }).handler(
  async (): Promise<PublicKeyCredentialRequestOptionsJSON> => {
    const { startLoginPasskey } = await import("./webauthn.server");
    return startLoginPasskey();
  },
);

export const hubPasskeyFinishLogin = createServerFn({ method: "POST" })
  .validator((data: { response: AuthenticationResponseJSON }) => data)
  .handler(async ({ data }) => {
    const { finishLoginPasskey } = await import("./webauthn.server");
    return finishLoginPasskey(data.response);
  });

export const hubPasskeyList = createServerFn({ method: "POST" })
  .validator((data?: { token?: string }) => data ?? {})
  .handler(async ({ data }) => {
    const { listPasskeysHub } = await import("./webauthn.server");
    return listPasskeysHub(data.token);
  });

export const hubPasskeyDelete = createServerFn({ method: "POST" })
  .validator((data: { token?: string; id: string }) => data)
  .handler(async ({ data }) => {
    const { deletePasskeyHub } = await import("./webauthn.server");
    return deletePasskeyHub(data.token, data.id);
  });
