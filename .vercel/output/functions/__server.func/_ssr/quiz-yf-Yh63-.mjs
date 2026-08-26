import { t as createServerFn } from "./ssr.mjs";
import { n as createServerRpc, r as fetchJson } from "./cache-B5Jaxvhn.mjs";
import { r as decodeEntities } from "./sanitize-bdtROC8q.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/quiz-yf-Yh63-.js
var FALLBACK = [
	{
		question: "Столица Франции?",
		answer: "Париж",
		category: "География",
		difficulty: "easy"
	},
	{
		question: "Сколько планет в Солнечной системе?",
		answer: "8",
		category: "Наука",
		difficulty: "easy"
	},
	{
		question: "Кто написал «Войну и мир»?",
		answer: "Лев Толстой",
		category: "Литература",
		difficulty: "easy"
	},
	{
		question: "В каком году человек впервые ступил на Луну?",
		answer: "1969",
		category: "История",
		difficulty: "medium"
	},
	{
		question: "Химический символ золота?",
		answer: "Au",
		category: "Наука",
		difficulty: "easy"
	},
	{
		question: "Самая длинная река в мире?",
		answer: "Нил (или Амазонка — по разным методикам)",
		category: "География",
		difficulty: "medium"
	},
	{
		question: "Сколько клавиш у стандартного фортепиано?",
		answer: "88",
		category: "Музыка",
		difficulty: "medium"
	},
	{
		question: "Как называется ближайшая к Солнцу планета?",
		answer: "Меркурий",
		category: "Наука",
		difficulty: "easy"
	}
];
function pickFallback() {
	return FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
}
var getQuiz_createServerFn_handler = createServerRpc({
	id: "35006b52e079b8125e37a1269f6c8d91fe778baa53cddafdb6069593d25f4963",
	name: "getQuiz",
	filename: "src/lib/server/quiz.ts"
}, (opts) => getQuiz.__executeServer(opts));
var getQuiz = createServerFn({ method: "GET" }).handler(getQuiz_createServerFn_handler, async () => {
	try {
		const row = (await fetchJson("https://opentdb.com/api.php?amount=1&type=multiple", 8e3)).results?.[0];
		if (!row) return pickFallback();
		return {
			question: decodeEntities(row.question),
			answer: decodeEntities(row.correct_answer),
			category: decodeEntities(row.category),
			difficulty: row.difficulty
		};
	} catch {
		return pickFallback();
	}
});
//#endregion
export { getQuiz_createServerFn_handler };
