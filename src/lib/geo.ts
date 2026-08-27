import { reverseCity } from "@/lib/server/weather";
import type { City } from "@/lib/hub/types";

export function locateCity(): Promise<City> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("no-geo"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        try {
          const hit = await reverseCity({ data: { lat, lon } });
          resolve(
            hit
              ? { name: hit.name, lat: hit.lat, lon: hit.lon, tz: hit.tz, country: hit.country }
              : { name: "Здесь", lat, lon, tz },
          );
        } catch {
          resolve({ name: "Здесь", lat, lon, tz });
        }
      },
      () => reject(new Error("denied")),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 6 * 3600_000 },
    );
  });
}
