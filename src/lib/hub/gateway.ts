/** Normalize OpenClaw / OpenAI-compatible gateway origin (no trailing /v1). */
export function normalizeGatewayUrl(raw: string) {
  let s = raw.trim();
  if (s.startsWith("ws://")) s = `http://${s.slice(5)}`;
  else if (s.startsWith("wss://")) s = `https://${s.slice(6)}`;
  s = s.replace(/\/+$/, "");
  s = s.replace(/\/chat\/completions$/i, "");
  s = s.replace(/\/v1$/i, "");
  return s.replace(/\/+$/, "");
}

export function chatCompletionsUrl(base: string) {
  return `${normalizeGatewayUrl(base)}/v1/chat/completions`;
}

export function explainGatewayError(status: number, body: string, name: string) {
  if (status === 401 || status === 403) return `Ключ отклонён (${name})`;
  if (status === 429 || status === 402) return `Лимит ${name}. Попробуйте позже.`;
  if (status === 404 || status === 405) {
    return "Шлюз OpenClaw не принимает чат по HTTP. Включите gateway.http.endpoints.chatCompletions.enabled (см. OPENCLAW.md).";
  }
  const snippet = body.replace(/\s+/g, " ").trim().slice(0, 160);
  return snippet || `${name} ${status}`;
}
