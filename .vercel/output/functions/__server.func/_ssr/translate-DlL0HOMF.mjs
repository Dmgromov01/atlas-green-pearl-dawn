import { t as createServerFn } from "./ssr.mjs";
import { n as createServerRpc, r as fetchJson } from "./cache-B5Jaxvhn.mjs";
import { n as clampText } from "./sanitize-bdtROC8q.mjs";
import { t as rateLimit } from "./limit-CEZuieKn.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/translate-DlL0HOMF.js
var MAX = 1500;
var PAIRS = /* @__PURE__ */ new Set([
	"en|ru",
	"ru|en",
	"es|ru",
	"ru|es",
	"de|ru",
	"ru|de"
]);
var translateText_createServerFn_handler = createServerRpc({
	id: "942cd3f894f0e29d46c32574b074909ec7cb4fdd9481542258cc4ea51fb3daca",
	name: "translateText",
	filename: "src/lib/server/translate.ts"
}, (opts) => translateText.__executeServer(opts));
var translateText = createServerFn({ method: "POST" }).validator((data) => data).handler(translateText_createServerFn_handler, async ({ data }) => {
	if (!rateLimit("translate", 30, 6e5)) throw new Error("Слишком много запросов. Подождите немного.");
	const text = clampText(data.text, MAX);
	if (!text) throw new Error("Введите текст");
	const pair = PAIRS.has(data.pair) ? data.pair : "en|ru";
	const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(pair)}`;
	let raw;
	try {
		raw = await fetchJson(url, 1e4);
	} catch (err) {
		if ((err instanceof Error ? err.message : "").includes("429")) throw new Error("Лимит переводчика. Попробуйте через минуту.");
		throw new Error("Перевод недоступен");
	}
	if (raw.responseStatus && raw.responseStatus !== 200) throw new Error(raw.responseDetails || "Перевод недоступен");
	const out = raw.responseData?.translatedText?.trim() ?? "";
	if (!out) throw new Error("Пустой ответ переводчика");
	return { text: out };
});
//#endregion
export { translateText_createServerFn_handler };
