import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { h as localDateKey, l as cn, u as formatDayLabel } from "./router-BGvdNc_L.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/datetime-6-f-tiPd.js
var import_jsx_runtime = require_jsx_runtime();
/** Production calendar (RU) — extend per year without touching UI. */
var HOLIDAYS = [
	{
		date: "2026-01-01",
		summary: "Новый год"
	},
	{
		date: "2026-01-02",
		summary: "Новогодние каникулы"
	},
	{
		date: "2026-01-07",
		summary: "Рождество"
	},
	{
		date: "2026-02-23",
		summary: "День защитника Отечества"
	},
	{
		date: "2026-03-08",
		summary: "Международный женский день"
	},
	{
		date: "2026-05-01",
		summary: "Праздник Весны и Труда"
	},
	{
		date: "2026-05-09",
		summary: "День Победы"
	},
	{
		date: "2026-06-12",
		summary: "День России"
	},
	{
		date: "2026-11-04",
		summary: "День народного единства"
	}
];
function holidaysInRange(fromIso, toIso) {
	const from = fromIso.slice(0, 10);
	const to = toIso.slice(0, 10);
	return HOLIDAYS.filter((h) => h.date >= from && h.date <= to).map((h) => ({
		id: `holiday-${h.date}`,
		start: `${h.date}T00:00:00`,
		summary: h.summary,
		source: "holiday",
		allDay: true
	}));
}
var field = "h-11 rounded-xl border border-border bg-muted px-2 text-xs font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
function slots() {
	const out = [];
	for (let h = 0; h < 24; h++) for (const m of [0, 30]) out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
	return out;
}
var TIMES = slots();
function DateField({ value, onChange, days = 14, className }) {
	const start = /* @__PURE__ */ new Date();
	start.setHours(0, 0, 0, 0);
	const opts = Array.from({ length: days }, (_, i) => {
		const d = new Date(start);
		d.setDate(start.getDate() + i);
		return {
			key: localDateKey(d),
			label: formatDayLabel(d)
		};
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
		value,
		onChange: (e) => onChange(e.target.value),
		className: cn(field, "min-w-0 flex-1", className),
		"aria-label": "Дата",
		children: opts.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: o.key,
			children: o.label
		}, o.key))
	});
}
function TimeField({ value, onChange, className }) {
	const list = TIMES.includes(value) ? TIMES : [value, ...TIMES];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
		value,
		onChange: (e) => onChange(e.target.value),
		className: cn(field, "w-[5.75rem] shrink-0", className),
		"aria-label": "Время",
		children: list.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: t,
			children: t
		}, t))
	});
}
function nextHourValue() {
	const d = /* @__PURE__ */ new Date();
	d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
	return {
		date: localDateKey(d),
		time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
	};
}
function combineLocal(date, time) {
	const t = time || "09:00";
	const d = date || nextHourValue().date;
	return (/* @__PURE__ */ new Date(`${d}T${t}:00`)).toISOString();
}
//#endregion
export { nextHourValue as a, holidaysInRange as i, TimeField as n, combineLocal as r, DateField as t };
