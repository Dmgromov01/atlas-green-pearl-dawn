import { timingSafeEqual } from "node:crypto";

export function cronSecretAuthorized(expectedRaw: string | undefined, suppliedRaw: string | null) {
  const expected = (expectedRaw || "").trim();
  const supplied = suppliedRaw || "";
  if (!expected || expected.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}
