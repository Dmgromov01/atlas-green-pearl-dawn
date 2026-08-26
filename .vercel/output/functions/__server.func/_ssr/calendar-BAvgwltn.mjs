import { n as create, t as persist } from "../_libs/zustand.mjs";
import { g as uid } from "./router-BGvdNc_L.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/calendar-BAvgwltn.js
function demoEvent() {
	const start = new Date(Date.now() + 72e5);
	start.setMinutes(0, 0, 0);
	return {
		id: "seed-cal-1",
		start: start.toISOString(),
		summary: "Созвон по проекту",
		source: "local"
	};
}
var useCalendar = create()(persist((set) => ({
	events: [demoEvent()],
	add: (event) => {
		const summary = event.summary.trim().slice(0, 120);
		if (!summary) return;
		set((s) => ({ events: [...s.events, {
			...event,
			summary,
			id: uid(),
			source: "local"
		}] }));
	},
	remove: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
	reset: () => set({ events: [] })
}), { name: "r2d2.calendar.v1" }));
//#endregion
export { useCalendar as t };
