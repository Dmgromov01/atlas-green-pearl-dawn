import { createServerFn } from "@tanstack/react-start";
import type { HubRole } from "@/lib/hub/identity";

export const adminListUsers = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const { listUsersAdmin } = await import("./hub-admin.server");
    return listUsersAdmin(data.token);
  });

export const adminPatchUser = createServerFn({ method: "POST" })
  .validator(
    (data: {
      token: string;
      userId: string;
      allowed?: boolean;
      allowGlobalAi?: boolean;
      quotaDaily?: number;
      role?: HubRole;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { patchUserAdmin } = await import("./hub-admin.server");
    return patchUserAdmin(data);
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .validator((data: { token: string; userId: string }) => data)
  .handler(async ({ data }) => {
    const { deleteUserAdmin } = await import("./hub-admin.server");
    return deleteUserAdmin(data.token, data.userId);
  });

export const adminAudit = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const { auditAdmin } = await import("./hub-admin.server");
    return auditAdmin(data.token);
  });
