import { cn, formatDayLabel, localDateKey } from "@/lib/utils";

const field =
  "h-9 min-w-0 appearance-none rounded-md border border-border bg-muted px-3 text-xs font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

function slots() {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
}

const TIMES = slots();

export function DateField({
  value,
  onChange,
  days = 14,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  days?: number;
  className?: string;
}) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const opts = Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return { key: localDateKey(d), label: formatDayLabel(d) };
  });
  const list = opts.some((o) => o.key === value) ? opts : [{ key: value, label: value }, ...opts];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(field, "flex-1", className)}
      aria-label="Дата"
    >
      {list.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function TimeField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const list = TIMES.includes(value) ? TIMES : [value, ...TIMES];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(field, "w-[4.9rem] flex-none tabular-nums", className)}
      aria-label="Время"
    >
      {list.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

export function nextHourValue() {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return {
    date: localDateKey(d),
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

export function combineLocal(date: string, time: string) {
  const t = time || "09:00";
  const d = date || nextHourValue().date;
  const [y, mo, day] = d.split("-").map((n) => Number(n));
  const [hh, mm] = t.split(":").map((n) => Number(n));
  const local = new Date(y || 2026, (mo || 1) - 1, day || 1, hh || 0, mm || 0, 0, 0);
  if (Number.isNaN(local.getTime())) return new Date().toISOString();
  return local.toISOString();
}
