import { cn, formatDayLabel, localDateKey } from "@/lib/utils";

const field =
  "h-9 appearance-none rounded-full border border-border bg-muted px-3 text-xs font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

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
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(field, "min-w-0 flex-1", className)}
      aria-label="Дата"
    >
      {opts.map((o) => (
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
    <div className={cn("time-oval", className)}>
      <span className="time-oval__value">{value}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="time-oval__select"
        aria-label="Время"
      >
        {list.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
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
  return new Date(`${d}T${t}:00`).toISOString();
}
