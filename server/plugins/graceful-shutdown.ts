import { dbSource, getPglite } from "@/lib/db";

let stopping = false;

/** Close embedded Postgres cleanly and exit fast, avoiding systemd SIGKILL. */
export default function gracefulShutdown(): void {
  const handle = (): void => {
    if (stopping) return;
    stopping = true;
    process.stderr.write("[shutdown] SIGTERM received\n");
    const force = setTimeout(() => {
      process.stderr.write("[shutdown] force-exit timer fired\n");
      process.exit(0);
    }, 5000);
    force.unref();
    (async () => {
      try {
        if (dbSource === "pglite") {
          process.stderr.write("[shutdown] closing PGLite\n");
          const pg = await getPglite();
          await pg.close();
          process.stderr.write("[shutdown] PGLite closed\n");
        }
      } catch (err) {
        process.stderr.write(`[shutdown] close error: ${String(err)}\n`);
      }
      process.exit(0);
    })();
  };
  process.on("SIGTERM", handle);
  process.on("SIGINT", handle);
}
