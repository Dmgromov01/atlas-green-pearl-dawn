//#region node_modules/.nitro/vite/services/ssr/assets/limit-CEZuieKn.js
var buckets = /* @__PURE__ */ new Map();
/** In-memory limiter for anonymous server functions. */
function rateLimit(key, max, windowMs) {
	const now = Date.now();
	const hit = buckets.get(key);
	if (!hit || now > hit.reset) {
		buckets.set(key, {
			n: 1,
			reset: now + windowMs
		});
		return true;
	}
	if (hit.n >= max) return false;
	hit.n += 1;
	return true;
}
//#endregion
export { rateLimit as t };
