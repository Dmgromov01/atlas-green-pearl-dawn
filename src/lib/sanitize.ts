const ENTITY: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  laquo: "«",
  raquo: "»",
  hellip: "…",
};

export function decodeEntities(input: string) {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, code: string) => {
      if (code[0] === "#") {
        const n =
          code[1]?.toLowerCase() === "x"
            ? parseInt(code.slice(2), 16)
            : parseInt(code.slice(1), 10);
        return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
      }
      return ENTITY[code.toLowerCase()] ?? "";
    });
}

export function stripHtml(input: string) {
  return decodeEntities(input)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PRIVATE_HOST =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|0\.0\.0\.0|169\.254\.\d+\.\d+|::1|\[::1\]|0:0:0:0:0:0:0:1)$/i;

function isPrivateIpv4(host: string) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const oct = m.slice(1).map(Number);
  if (oct.some((n) => n > 255)) return true;
  const [a, b] = oct as [number, number, number, number];
  if (a === 0 || a === 127 || a === 10 || a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a >= 224) return true;
  return false;
}

export function assertPublicHttps(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Некорректный URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("Разрешён только HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("URL с учётными данными запрещён");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (
    PRIVATE_HOST.test(host) ||
    isPrivateIpv4(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost") ||
    host.includes(":")
  ) {
    throw new Error("Приватные адреса запрещены");
  }
  return url;
}

export function clampText(input: string, max: number) {
  const t = input.trim();
  if (t.length <= max) return t;
  return t.slice(0, max);
}
