import { createServerFn } from "@tanstack/react-start";

export const getAirQuality = createServerFn({ method: "GET" })
  .validator((data: { lat: number; lon: number }) => data)
  .handler(async ({ data }) => {
    const { loadAirQuality } = await import("./free-apis.server");
    return loadAirQuality(data);
  });

export const getNextHoliday = createServerFn({ method: "GET" })
  .validator((data: { countryCode?: string; year?: number }) => data)
  .handler(async ({ data }) => {
    const { loadNextHoliday } = await import("./free-apis.server");
    return loadNextHoliday(data);
  });

export const searchCitiesNominatim = createServerFn({ method: "GET" })
  .validator((data: { q: string }) => data)
  .handler(async ({ data }) => {
    const { loadCitiesNominatim } = await import("./free-apis.server");
    return loadCitiesNominatim(data);
  });

export const wikipediaSummary = createServerFn({ method: "GET" })
  .validator((data: { title: string }) => data)
  .handler(async ({ data }) => {
    const { loadWikipediaSummary } = await import("./free-apis.server");
    return loadWikipediaSummary(data);
  });
