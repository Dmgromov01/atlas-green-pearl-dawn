export function healthResponse() {
  return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
}
