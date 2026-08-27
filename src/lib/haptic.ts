type HapticKind = "light" | "medium" | "heavy" | "success";

export function haptic(kind: HapticKind = "light") {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  const ms = kind === "heavy" ? 24 : kind === "medium" ? 16 : kind === "success" ? 12 : 8;
  try {
    navigator.vibrate(ms);
  } catch {
    /* ignore */
  }
}
