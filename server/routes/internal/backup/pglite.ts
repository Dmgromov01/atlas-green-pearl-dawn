import { getPglite } from "@/lib/db";
import { cronSecretAuthorized } from "@/lib/server/backup-auth";

/** Consistent online PGLite snapshot. Requires the cron secret even on loopback. */
export default async function backupPglite(event: { req: Request }) {
  if (!cronSecretAuthorized(process.env.INTERNAL_CRON_SECRET, event.req.headers.get("x-cron-secret"))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const pg = await getPglite();
  const snapshot = await pg.dumpDataDir("gzip");
  return new Response(snapshot, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/gzip",
      "content-disposition": 'attachment; filename="pglite-snapshot.tar.gz"',
      "x-backup-format": "pglite-dump-v1",
    },
  });
}
