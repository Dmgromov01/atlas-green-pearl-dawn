import { hapticImpact } from "@/lib/telegram/webapp";

type HapticKind = "light" | "medium" | "heavy" | "success";

export function haptic(kind: HapticKind = "light") {
  if (hapticImpact(kind)) return;
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    const ms = kind === "heavy" ? 24 : kind === "medium" ? 16 : kind === "success" ? 12 : 8;
    try {
      navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}
