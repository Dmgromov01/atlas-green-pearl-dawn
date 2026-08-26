import type { CalEvent } from "@/lib/hub/types";

function unfold(raw: string) {
  return raw.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function icsTime(value: string): { iso: string; allDay?: boolean } | null {
  const v = value.trim();
  if (/^\d{8}$/.test(v)) {
    return { iso: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T00:00:00`, allDay: true };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] ? "Z" : ""}`;
  return { iso };
}

export function parseIcs(raw: string): CalEvent[] {
  const text = unfold(raw);
  const blocks = text.split(/BEGIN:VEVENT/i).slice(1);
  const out: CalEvent[] = [];
  for (const block of blocks) {
    const body = block.split(/END:VEVENT/i)[0] ?? "";
    const field = (name: string) => {
      const re = new RegExp(`^${name}[^:]*:(.*)$`, "im");
      return body.match(re)?.[1]?.trim() ?? "";
    };
    const summary = field("SUMMARY").replace(/\\n/g, " ").replace(/\\,/g, ",").trim();
    const uid = field("UID") || `${summary}-${field("DTSTART")}`;
    const startRaw = field("DTSTART");
    const parsed = icsTime(startRaw.split(";").pop() || startRaw);
    if (!summary || !parsed) continue;
    out.push({
      id: `ics:${uid}`.slice(0, 80),
      start: parsed.iso,
      summary: summary.slice(0, 160),
      source: "ics",
      allDay: parsed.allDay,
    });
  }
  return out;
}
