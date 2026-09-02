import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] || ".output/public/assets";
const maxMainJsGzip = 130 * 1024;
const maxCssGzip = 12 * 1024;
const files = readdirSync(root).map((name) => ({ name, size: statSync(join(root, name)).size }));
const js = files.filter((file) => file.name.endsWith(".js"));
const css = files.filter((file) => file.name.endsWith(".css"));
const main = js.find((file) => file.name.startsWith("index-"));
if (!main) throw new Error(`Main client asset not found in ${root}`);
const read = (name) => gzipSync(readFileSync(join(root, name))).length;
const mainGzip = read(main.name);
const cssGzip = css.reduce((total, file) => total + read(file.name), 0);
console.log(`[perf] main JS ${mainGzip} bytes gzip; CSS ${cssGzip} bytes gzip`);
if (mainGzip > maxMainJsGzip) throw new Error(`Main JS budget exceeded: ${mainGzip} > ${maxMainJsGzip}`);
if (cssGzip > maxCssGzip) throw new Error(`CSS budget exceeded: ${cssGzip} > ${maxCssGzip}`);
