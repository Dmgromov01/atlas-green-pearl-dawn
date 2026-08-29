import { getSql } from "@/lib/db";
import { envGatewayUrl } from "./openclaw.server";
import { healthResponse } from "./health-response";

async function pingGateway(): Promise<boolean> {
  try {
    const response = await fetch(`${envGatewayUrl()}/`, { signal: AbortSignal.timeout(2500) });
    return response.status < 500;
  } catch {
    return false;
  }
}

export function healthz() {
  return healthResponse();
}

export async function readyz() {
  const checks = await Promise.allSettled([
    (async () => {
      const sql = await getSql();
      await sql.query("select 1");
    })(),
    pingGateway(),
  ]);
  const databaseOk = checks[0].status === "fulfilled";
  const gatewayOk = checks[1].status === "fulfilled" && checks[1].value === true;
  const ok = databaseOk && gatewayOk;
  return Response.json(
    { status: ok ? "ready" : "not_ready", checks: { database: databaseOk, gateway: gatewayOk } },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
