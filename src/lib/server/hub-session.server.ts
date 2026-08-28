import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { SESSION_TTL_SEC } from "@/lib/hub/identity";

export const HUB_SESSION_COOKIE = "hub_session";

function cookieSecure() {
  const origin = (process.env.HUB_ORIGIN || "https://hub.gbkz.uk").trim();
  return origin.startsWith("https://") || process.env.NODE_ENV === "production";
}

export function readSessionCookie(): string | null {
  try {
    const value = getCookie(HUB_SESSION_COOKIE);
    return value && value.length > 8 ? value : null;
  } catch {
    return null;
  }
}

export function writeSessionCookie(token: string) {
  try {
    setCookie(HUB_SESSION_COOKIE, token, {
      path: "/",
      httpOnly: true,
      secure: cookieSecure(),
      sameSite: "lax",
      maxAge: SESSION_TTL_SEC(),
    });
  } catch (err) {
    console.error("[hub-session] setCookie failed", err);
  }
}

export function clearSessionCookie() {
  try {
    deleteCookie(HUB_SESSION_COOKIE, { path: "/" });
  } catch {
    try {
      setCookie(HUB_SESSION_COOKIE, "", {
        path: "/",
        httpOnly: true,
        secure: cookieSecure(),
        sameSite: "lax",
        maxAge: 0,
      });
    } catch (err) {
      console.error("[hub-session] deleteCookie failed", err);
    }
  }
}

export function bearerOrCookie(token?: string | null) {
  if (token && token !== "cookie" && token.length > 8) return token;
  return readSessionCookie();
}
