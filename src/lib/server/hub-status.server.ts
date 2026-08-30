import { getSql } from "@/lib/db";
import { envGatewayUrl } from "./openclaw.server";
import { requireHubUser } from "./hub-auth.server";
import { statusGcal } from "./gcal.server";

async function pingGateway() {
  const url = envGatewayUrl();
  try {
    const res = await fetch(`${url}/`, { signal: AbortSignal.timeout(2500) });
    return { ok: res.status < 500, status: res.status, url: "loopback" };
  } catch (err) {
    return { ok: false, status: 0, url: "loopback", error: err instanceof Error ? err.message : "offline" };
  }
}

export async function systemStatusHub(token?: string) {
  const { user } = await requireHubUser(token);
  const [gcal, gateway] = await Promise.all([
    statusGcal(token ?? "cookie"),
    pingGateway(),
  ]);
  return {
    user: { id: user.id, name: user.display_name, role: user.role },
    calendar: {
      google: {
        connected: gcal.connected,
        email: "email" in gcal ? gcal.email : null,
        familyId: "familyId" in gcal ? gcal.familyId : null,
        error: "error" in gcal ? gcal.error : null,
        note: "Живой семейный календарь хаба — Google Calendar. События с пометкой «семья» пишутся туда.",
      },
      icloud: {
        connected: false,
        appleId: null,
        familyHref: null,
        error: null,
        note: "iCloud CalDAV в хабе dormant: UI и автосинк отключены, таблица hub_icloud не дропается.",
      },
    },
    gateway,
    hub: { ok: true, bind: "127.0.0.1:8091" },
  };
}

export async function activityFeedHub(token?: string) {
  const { user } = await requireHubUser(token);
  const sql = await getSql();
  if (user.role === "admin") {
    return sql<{
      id: number;
      user_id: string | null;
      action: string;
      auth_method: string | null;
      detail: string | null;
      created_at: string;
      display_name: string | null;
    }>`
      select a.id, a.user_id, a.action, a.auth_method, a.detail,
             a.created_at::text as created_at, u.display_name
      from hub_audit a
      left join hub_users u on u.id = a.user_id
      order by a.id desc
      limit 80
    `;
  }
  return sql<{
    id: number;
    user_id: string | null;
    action: string;
    auth_method: string | null;
    detail: string | null;
    created_at: string;
    display_name: string | null;
  }>`
    select a.id, a.user_id, a.action, a.auth_method, a.detail,
           a.created_at::text as created_at, u.display_name
    from hub_audit a
    left join hub_users u on u.id = a.user_id
    where a.user_id = ${user.id}
    order by a.id desc
    limit 80
  `;
}
