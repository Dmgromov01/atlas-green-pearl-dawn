import { t as createServerFn } from "./ssr.mjs";
import { i as fetchText, n as createServerRpc, t as cached } from "./cache-B5Jaxvhn.mjs";
import { i as stripHtml, t as assertPublicHttps } from "./sanitize-bdtROC8q.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/digest-4ydc6s49.js
function tag(xml, name) {
	const cdata = xml.match(new RegExp(`<${name}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${name}>`, "i"));
	if (cdata?.[1]) return cdata[1];
	return xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1] ?? "";
}
function parseFeed(xml) {
	const items = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi), ...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi)];
	const out = [];
	for (const m of items.slice(0, 8)) {
		const chunk = m[0];
		const title = stripHtml(tag(chunk, "title"));
		const desc = stripHtml(tag(chunk, "description") || tag(chunk, "summary") || tag(chunk, "content"));
		const date = stripHtml(tag(chunk, "pubDate") || tag(chunk, "updated") || tag(chunk, "published"));
		const text = [title, desc].filter(Boolean).join(" — ").slice(0, 420);
		if (text) out.push({
			text,
			date: date || void 0
		});
	}
	return out;
}
async function loadRss(url) {
	const safe = assertPublicHttps(url);
	return parseFeed(await cached(`rss:${safe.href}`, 72e4, () => fetchText(safe.href, 9e3, 6e5)));
}
var getDigest_createServerFn_handler = createServerRpc({
	id: "e5e829d5b7467a7dc6a78e3aa48d8a3faa53e7dee6708408ecbea27398aa55d3",
	name: "getDigest",
	filename: "src/lib/server/digest.ts"
}, (opts) => getDigest.__executeServer(opts));
var getDigest = createServerFn({ method: "POST" }).validator((data) => data).handler(getDigest_createServerFn_handler, async ({ data }) => {
	const sources = (data.sources ?? []).slice(0, 12);
	const blocks = new Array(sources.length);
	let total = 0;
	await Promise.all(sources.map(async (s, i) => {
		if (s.type === "tg") {
			blocks[i] = {
				title: s.title || s.name,
				type: "tg",
				posts: [],
				error: "Telegram-каналы подключаются через бота. Добавьте RSS-ленту источника."
			};
			return;
		}
		try {
			const posts = await loadRss(s.name);
			total += posts.length;
			blocks[i] = {
				title: s.title || s.name,
				type: "rss",
				posts
			};
		} catch (err) {
			blocks[i] = {
				title: s.title || s.name,
				type: "rss",
				posts: [],
				error: err instanceof Error ? err.message : "Не удалось загрузить"
			};
		}
	}));
	return {
		blocks: blocks.filter(Boolean),
		total,
		ts: Date.now()
	};
});
//#endregion
export { getDigest_createServerFn_handler };
