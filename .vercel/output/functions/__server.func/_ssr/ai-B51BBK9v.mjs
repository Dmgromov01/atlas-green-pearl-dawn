import { t as createServerFn } from "./ssr.mjs";
import { n as createServerRpc, t as cached } from "./cache-B5Jaxvhn.mjs";
import { n as clampText } from "./sanitize-bdtROC8q.mjs";
import { t as rateLimit } from "./limit-CEZuieKn.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ai-B51BBK9v.js
var MAX_POSTS = 8;
var MAX_CHARS = 3500;
var summarizeDigest_createServerFn_handler = createServerRpc({
	id: "8795c6ca53661950be33beb49cb11eb7ea47c2ff3d44100155972ea4cf15c2a6",
	name: "summarizeDigest",
	filename: "src/lib/server/ai.ts"
}, (opts) => summarizeDigest.__executeServer(opts));
var summarizeDigest = createServerFn({ method: "POST" }).validator((data) => data).handler(summarizeDigest_createServerFn_handler, async ({ data }) => {
	const apiKey = process.env.XAI_API_KEY;
	if (!apiKey) return {
		text: "",
		unavailable: true
	};
	if (!rateLimit("ai:summarize", 8, 6e5)) return {
		text: "Слишком много запросов. Подождите несколько минут.",
		unavailable: true
	};
	const posts = (data.posts ?? []).slice(0, MAX_POSTS).map((p) => clampText(p, 400));
	const blob = posts.join("\n• ");
	if (!blob) return { text: "" };
	const body = clampText(`Источник: ${data.title}\n• ${blob}`, MAX_CHARS);
	const cacheKey = `sum:${data.title}:${posts.length}:${posts[0]?.slice(0, 48) ?? ""}`;
	return cached(cacheKey, 18e5, async () => {
		const res = await fetch("https://api.x.ai/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: "grok-4.5",
				max_tokens: 280,
				messages: [{
					role: "system",
					content: "Ты редактор короткого новостного дайджеста. 3–5 предложений на русском, факты без воды, без эмодзи, без заголовка."
				}, {
					role: "user",
					content: body
				}]
			}),
			signal: AbortSignal.timeout(2e4)
		});
		if (!res.ok) return {
			text: "",
			unavailable: true
		};
		return { text: (await res.json()).choices?.[0]?.message?.content?.trim() ?? "" };
	});
});
//#endregion
export { summarizeDigest_createServerFn_handler };
