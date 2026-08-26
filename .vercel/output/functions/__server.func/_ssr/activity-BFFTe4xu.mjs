import { t as createServerFn } from "./ssr.mjs";
import { n as createServerRpc, r as fetchJson } from "./cache-B5Jaxvhn.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/activity-BFFTe4xu.js
var FALLBACK = [
	{
		activity: "Прогуляться 20 минут без телефона",
		type: "recreational",
		participants: 1,
		price: 0
	},
	{
		activity: "Написать короткое письмо человеку, которого давно не видели",
		type: "social",
		participants: 1,
		price: 0
	},
	{
		activity: "Приготовить что-то из того, что уже есть в холодильнике",
		type: "cooking",
		participants: 1,
		price: .2
	},
	{
		activity: "Разобрать одну полку или ящик",
		type: "busywork",
		participants: 1,
		price: 0
	},
	{
		activity: "Выучить 5 новых слов на другом языке",
		type: "education",
		participants: 1,
		price: 0
	},
	{
		activity: "Сделать растяжку на 10 минут",
		type: "recreational",
		participants: 1,
		price: 0
	},
	{
		activity: "Нарисовать то, что видите из окна",
		type: "recreational",
		participants: 1,
		price: 0
	},
	{
		activity: "Позвонить другу и спросить, как у него день",
		type: "social",
		participants: 2,
		price: 0
	}
];
function pickFallback() {
	return FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
}
var getActivity_createServerFn_handler = createServerRpc({
	id: "a3352d9583c6f4fcf11a8b767e95c78c387c8eb0b496e295cf9b4cd8a54f5793",
	name: "getActivity",
	filename: "src/lib/server/activity.ts"
}, (opts) => getActivity.__executeServer(opts));
var getActivity = createServerFn({ method: "GET" }).handler(getActivity_createServerFn_handler, async () => {
	try {
		const raw = await fetchJson("https://bored.api.lewagon.com/api/activity", 8e3);
		if (!raw?.activity) return pickFallback();
		return {
			activity: raw.activity,
			type: raw.type,
			participants: raw.participants,
			price: raw.price,
			accessibility: raw.accessibility,
			link: raw.link
		};
	} catch {
		return pickFallback();
	}
});
//#endregion
export { getActivity_createServerFn_handler };
