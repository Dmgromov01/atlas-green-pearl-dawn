import { n as create, t as persist } from "../_libs/zustand.mjs";
import { g as uid } from "./router-BGvdNc_L.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/dictionary-B-oN6zxD.js
var useDictionary = create()(persist((set) => ({
	entries: [],
	add: (src, dst, pair) => {
		const s = src.trim();
		if (!s) return;
		set((st) => ({ entries: [{
			id: uid(),
			src: s.slice(0, 500),
			dst: dst.trim().slice(0, 500),
			pair,
			createdAt: Date.now()
		}, ...st.entries].slice(0, 200) }));
	},
	remove: (id) => set((st) => ({ entries: st.entries.filter((e) => e.id !== id) })),
	reset: () => set({ entries: [] })
}), { name: "r2d2.dict.v1" }));
//#endregion
export { useDictionary as t };
