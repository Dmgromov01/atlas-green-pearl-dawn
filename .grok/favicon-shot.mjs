import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { writeFileSync } from "node:fs";

const svg = `file:///workspace/public/favicon.svg`;
const html = `<!DOCTYPE html><html><body style="margin:0;background:#888">
<canvas id="c16" width="16" height="16"></canvas>
<canvas id="c32" width="32" height="32"></canvas>
<img id="s" src="${svg}" />
<script>
const img = document.getElementById('s');
img.onload = () => {
  for (const [id, size] of [['c16',16],['c32',32]]) {
    const c = document.getElementById(id);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);
  }
  document.title = 'ready';
};
</script>
</body></html>`;
writeFileSync("/workspace/.grok/favicon-preview.html", html);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 64, height: 64 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL("/workspace/.grok/favicon-preview.html").href, { waitUntil: "networkidle" });
await page.waitForFunction(() => document.title === "ready");
const c16 = await page.$("#c16");
const c32 = await page.$("#c32");
await c16.screenshot({ path: "/workspace/.grok/favicon-16.png" });
await c32.screenshot({ path: "/workspace/.grok/favicon-32.png" });
await browser.close();
console.log("rasterized");
