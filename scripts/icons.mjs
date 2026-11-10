// Draws the extension icons into icons/. Run after changing the drawing:
//   node scripts/icons.mjs
import { chromium } from "playwright-core";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect x="4" y="4" width="120" height="120" rx="28" fill="#e62117"/>
  <path d="M28 38 L62 64 L28 90 Z M62 38 L96 64 L62 90 Z" fill="#fff" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${SVG}`);
  await page.screenshot({ path: join(root, "icons", `icon-${size}.png`), omitBackground: true });
}
await browser.close();
