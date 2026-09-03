import { dbSource, getPglite } from "@/lib/db";

let stopping = false;

/**
 * Nitro node-server doesn't install a working SIGTERM handler in this build, so
 * systemd escalates to SIGKILL after TimeoutStopSec. This closes the embedded
 * Postgres cleanly (WAL checkpoint) and exits fast, keeping restarts quick and
 * avoiding forced kills.
 */
export default function gracefulShutdown(): void {
  const handle = (): void => {
    if (stopping) return;
    stopping = true;
    // Hard ceiling: never let a stuck close hang the service.
    const force = setTimeout(() => process.exit(0), 5000);
    force.unref();
    (async () => {
      try {
        if (dbSource === "pglite") {
          const pg = await getPglite();
          await pg.close();
        }
      } catch {
        // Best effort — exit regardless.
      }
      process.exit(0);
    })();
  };
  process.on("SIGTERM", handle);
  process.on("SIGINT", handle);
}
