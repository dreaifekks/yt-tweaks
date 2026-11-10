// End-to-end check of the extension against a fake youtube.com: a throwaway Chromium loads
// the unpacked extension, and a local HTTPS server answers as www.youtube.com with a page
// that has the parts the extension touches, built the way YouTube builds them.
//   npm test                         tests this directory as it is
//   EXT_DIR=dist/chrome npm test     tests a build
// test/live.mjs runs the same kind of checks on the real site.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ext = path.resolve(process.env.EXT_DIR || fileURLToPath(new URL("..", import.meta.url)));
// Chromium names an unpacked extension after its folder's path.
const id = createHash("sha256").update(ext).digest("hex").slice(0, 32).replace(/./g, (c) => "abcdefghijklmnop"[parseInt(c, 16)]);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ytt-e2e-"));
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", dir + "/k.pem", "-out", dir + "/c.pem", "-days", "1", "-subj", "/CN=www.youtube.com"], { stdio: "ignore" });

const video = (n) => `<ytd-rich-item-renderer class="video"><a href="/watch?v=v${n}">video ${n}</a></ytd-rich-item-renderer>`;
const lockup = (cls, href) => `<yt-lockup-view-model class="${cls}"><a href="${href}">${cls}</a></yt-lockup-view-model>`;
const PAGE = `<!doctype html><html><head><style>
body{margin:0}
ytd-rich-grid-renderer{display:block}
#contents{display:flex;flex-wrap:wrap}
ytd-rich-item-renderer{display:block;height:40px;width:calc(100%/var(--ytd-rich-grid-items-per-row))}
ytd-rich-section-renderer{display:flex;width:100%;height:40px}
yt-lockup-view-model,ytd-reel-shelf-renderer,ytd-compact-radio-renderer{display:block;height:20px}
#movie_player{position:relative;width:800px;height:450px;background:#222}
.ytp-right-controls-left{display:flex;position:absolute;right:0;bottom:0;height:40px}
.ytp-button{height:40px}
</style></head><body>
<input id="search" />
<ytd-browse page-subtype="home"><ytd-rich-grid-renderer><div id="contents">
${[1, 2, 3].map(video).join("")}
<ytd-rich-item-renderer class="mix"><a href="/watch?v=m1&list=RDm1&start_radio=1">mix</a></ytd-rich-item-renderer>
${[4, 5].map(video).join("")}
<ytd-rich-item-renderer class="playlist"><a href="/playlist?list=PL1">playlist</a></ytd-rich-item-renderer>
<ytd-rich-section-renderer class="shorts-shelf"><ytd-rich-shelf-renderer is-shorts><a href="/shorts/s1">short</a></ytd-rich-shelf-renderer></ytd-rich-section-renderer>
${[6, 7].map(video).join("")}
<ytd-rich-item-renderer class="short"><a href="/shorts/s2">short</a></ytd-rich-item-renderer>
<ytd-rich-section-renderer class="news-shelf"><ytd-rich-shelf-renderer><a href="/watch?v=n1">news</a><a href="/shorts/s3">a short among the news</a></ytd-rich-shelf-renderer></ytd-rich-section-renderer>
<ytd-rich-section-renderer class="games-shelf"><ytd-rich-shelf-renderer><a href="/playables/g1">game</a></ytd-rich-shelf-renderer></ytd-rich-section-renderer>
${[8, 9, 10, 11, 12].map(video).join("")}
</div></ytd-rich-grid-renderer></ytd-browse>
<ytd-browse page-subtype="subscriptions"><ytd-rich-item-renderer class="elsewhere"><a href="/watch?v=e1&list=PL2">a playlist on another page</a></ytd-rich-item-renderer></ytd-browse>
<ytd-watch-next-secondary-results-renderer><ytd-item-section-renderer><div id="contents">
${lockup("video", "/watch?v=r1")}${lockup("mix", "/watch?v=r2&list=RDr2&start_radio=1")}${lockup("playlist", "/playlist?list=PL3")}${lockup("short", "/shorts/s4")}${lockup("game", "/playables/g2")}
<ytd-reel-shelf-renderer class="shorts-shelf"></ytd-reel-shelf-renderer><ytd-compact-radio-renderer class="mix"></ytd-compact-radio-renderer>
${lockup("video", "/watch?v=r3")}
</div></ytd-item-section-renderer></ytd-watch-next-secondary-results-renderer>
<div id="movie_player" class="html5-video-player"><video></video><div class="ytp-right-controls"><div class="ytp-right-controls-left"><button class="ytp-button ytp-settings-button">⚙</button></div></div></div>
<script>
// The grid, as YouTube's works: a count of its own from the width, stored and laid out again
// only when it differs from the one it has. It says whether the count changed.
class Grid {
  constructor(host) { this.hostElement = host; this.elementsPerRow = 0; this.layouts = 0; this.positions = 0; }
  refreshGridLayout(force) {
    const own = innerWidth >= 1200 ? 3 : 2;
    const changed = this.elementsPerRow !== own;
    if (!force && !changed) return false;
    this.elementsPerRow = own;
    this.layouts++;
    this.hostElement.style.setProperty("--ytd-rich-grid-items-per-row", this.elementsPerRow);
    return changed;
  }
  updateRichItemGridPositions() { this.positions++; }
}
customElements.define("ytd-rich-grid-renderer", class extends HTMLElement {
  constructor() { super(); this.polymerController = new Grid(this); }
  connectedCallback() { this.polymerController.refreshGridLayout(); new ResizeObserver(() => this.polymerController.refreshGridLayout()).observe(this); }
});
// The player: speeds from 0.25 to 2, and it keeps wheel events over it to itself.
const player = document.getElementById("movie_player");
const media = player.querySelector("video");
player.getPlaybackRate = () => media.playbackRate;
player.setPlaybackRate = (rate) => { media.playbackRate = Math.min(2, Math.max(0.25, rate)); };
player.addEventListener("wheel", (e) => e.stopPropagation(), true);
dispatchEvent(new Event("yt-navigate-finish"));
</script></body></html>`;

const server = https.createServer({ key: fs.readFileSync(dir + "/k.pem"), cert: fs.readFileSync(dir + "/c.pem") }, (req, res) => {
  if (req.url === "/favicon.ico") return res.writeHead(204).end();
  res.writeHead(200, { "content-type": "text/html;charset=utf-8" }).end(PAGE);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail === "" ? "" : "  " + JSON.stringify(detail)}`);
};

const ctx = await chromium.launchPersistentContext(dir + "/p", {
  headless: true,
  channel: "chromium",
  ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 900 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, `--host-resolver-rules=MAP www.youtube.com 127.0.0.1:${server.address().port}`, "--ignore-certificate-errors"],
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("https://www.youtube.com/");
await page.waitForFunction(() => document.querySelector(".ytt-speed") && document.documentElement.dataset.yttMaxColumns);
const popup = await ctx.newPage();
await popup.goto(`chrome-extension://${id}/popup.html`);
await page.bringToFront();

// ---- videos per row --------------------------------------------------------------------
const grid = () =>
  page.evaluate(() => {
    const el = document.querySelector("ytd-rich-grid-renderer");
    const g = el.polymerController;
    return { perRow: Number(el.style.getPropertyValue("--ytd-rich-grid-items-per-row")), property: g.elementsPerRow, own: Object.hasOwn(g, "elementsPerRow"), layouts: g.layouts, positions: g.positions };
  });
for (const [width, expected] of [[700, 1], [800, 2], [1023, 2], [1024, 3], [1300, 4], [1536, 5], [2560, 5]]) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(150);
  const s = await grid();
  check(`${width} px wide: ${expected} per row`, s.perRow === expected && s.property === expected && s.own, s);
}
const before = await grid();
await page.setViewportSize({ width: 2500, height: 900 });
await page.waitForTimeout(150);
const after = await grid();
check("a resize that changes no count doesn't lay out again", after.layouts === before.layouts && after.perRow === 5, { before, after });

await popup.selectOption("#maxColumns", "8");
await page.waitForTimeout(200);
let s = await grid();
check("a higher most from the popup: 8 per row on a wide window, laid out and positioned again", s.perRow === 8 && s.layouts === after.layouts + 1 && s.positions === after.positions + 1, s);
await popup.selectOption("#maxColumns", "5");
await page.setViewportSize({ width: 1600, height: 900 });
await page.waitForTimeout(200);

// ---- what's taken out ------------------------------------------------------------------
const shown = (scope) => page.evaluate((scope) => [...document.querySelectorAll(`${scope} #contents > *`)].filter((el) => getComputedStyle(el).display !== "none").map((el) => el.className), scope);
const HOME = 'ytd-browse[page-subtype="home"]';
const BESIDE = "ytd-watch-next-secondary-results-renderer";
check("the home feed shows only its videos", (await shown(HOME)).join() === Array(12).fill("video").join(), await shown(HOME));
check("the list beside a video shows only its videos", (await shown(BESIDE)).join() === "video,video", await shown(BESIDE));
check("a playlist on another page stays", await page.evaluate(() => getComputedStyle(document.querySelector(".elsewhere")).display !== "none"));
const rows = await page.evaluate(() => {
  const tops = [...document.querySelectorAll('ytd-browse[page-subtype="home"] .video')].map((el) => el.getBoundingClientRect().top);
  return [...new Set(tops)].map((top) => tops.filter((t) => t === top).length);
});
check("with those gone the rows are full", rows.join() === "5,5,2", rows);

const kinds = (list) => [...new Set(list)].sort().join();
await popup.uncheck("#hideShorts");
await page.waitForTimeout(150);
check("Shorts switched off: the Shorts shelf and single Shorts are back, nothing else", kinds(await shown(HOME)) === "short,shorts-shelf,video" && kinds(await shown(BESIDE)) === "short,shorts-shelf,video", [await shown(HOME), await shown(BESIDE)]);
await popup.check("#hideShorts");
await popup.uncheck("#hideLists");
await page.waitForTimeout(150);
check("lists switched off: mixes and playlists are back", kinds(await shown(HOME)) === "mix,playlist,video" && kinds(await shown(BESIDE)) === "mix,playlist,video", [await shown(HOME), await shown(BESIDE)]);
await popup.check("#hideLists");
await popup.uncheck("#hideShelves");
await page.waitForTimeout(150);
check("other shelves switched off: the news shelf is back, with the Short it holds", kinds(await shown(HOME)) === "news-shelf,video", await shown(HOME));
await popup.check("#hideShelves");
await popup.uncheck("#hideGames");
await page.waitForTimeout(150);
check("games switched off: the games shelf and entry are back", kinds(await shown(HOME)) === "games-shelf,video" && kinds(await shown(BESIDE)) === "game,video", [await shown(HOME), await shown(BESIDE)]);
await popup.check("#hideGames");

// ---- playback speed --------------------------------------------------------------------
const speed = () => page.waitForTimeout(50).then(() => page.evaluate(() => ({ rate: document.querySelector("#movie_player video").playbackRate, button: document.querySelector(".ytp-right-controls-left").firstElementChild.textContent, toast: document.querySelector(".ytt-toast")?.textContent })));
check("the speed button comes first in the control bar's right group, showing 1×", (await speed()).button === "1×", await speed());

const button = await page.locator(".ytt-speed").boundingBox();
await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2);
await page.mouse.wheel(0, -100);
await page.waitForTimeout(350);
check("wheel up over the button: 1.25×, on the button and over the video", JSON.stringify(await speed()) === JSON.stringify({ rate: 1.25, button: "1.25×", toast: "1.25×" }), await speed());
await page.mouse.wheel(0, 100);
await page.waitForTimeout(350);
check("wheel down: 1×", (await speed()).rate === 1, await speed());
for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -30);
await page.waitForTimeout(350);
check("a burst of wheel events is one step, not six", (await speed()).rate === 1.25, await speed());
await page.mouse.move(200, 600);
await page.mouse.wheel(0, -100);
await page.waitForTimeout(350);
check("the wheel over the video without Ctrl leaves the speed alone", (await speed()).rate === 1.25, await speed());
await page.keyboard.down("Control");
await page.mouse.wheel(0, -100);
await page.keyboard.up("Control");
await page.waitForTimeout(350);
check("Ctrl + wheel up over the video: 1.5×", (await speed()).rate === 1.5, await speed());

await page.keyboard.press("]");
check("] : 1.75×", (await speed()).rate === 1.75, await speed());
await page.keyboard.press("[");
await page.keyboard.press("[");
check("[ twice: 1.25×", (await speed()).rate === 1.25, await speed());
await page.locator("#search").press("]");
check("] typed into a text box leaves the speed alone", (await speed()).rate === 1.25 && (await page.inputValue("#search")) === "]", await speed());
await page.locator("#search").blur();

await page.locator(".ytt-speed").click();
check("a click on the button: 1×", JSON.stringify(await speed()) === JSON.stringify({ rate: 1, button: "1×", toast: "1×" }), await speed());
await page.locator(".ytt-speed").click();
check("another click: back to 1.25×", (await speed()).rate === 1.25, await speed());

await popup.fill("#speedStep", "0.5");
await popup.fill("#speedMax", "1.5");
await popup.locator("#speedMax").blur();
await page.waitForTimeout(150);
await page.keyboard.press("]");
await page.keyboard.press("]");
check("a step of 0.5 and a highest of 1.5 from the popup: ] stops at 1.5×", (await speed()).rate === 1.5, await speed());
await page.evaluate(() => (document.querySelector("#movie_player video").playbackRate = 0.75));
check("a speed set elsewhere shows on the button", (await speed()).button === "0.75×", await speed());

// ---- the popup shows what is stored ----------------------------------------------------
await popup.reload();
const stored = await popup.evaluate(() => Object.fromEntries([...document.querySelectorAll("input, select")].map((el) => [el.id, el.type === "checkbox" ? el.checked : el.value])));
check("the popup opens with the stored settings", JSON.stringify(stored) === JSON.stringify({ maxColumns: "5", hideShorts: true, hideGames: true, hideLists: true, hideShelves: true, speedStep: "0.5", speedMin: "0.25", speedMax: "1.5" }), stored);

check("no errors on the page", errors.length === 0, errors);

await ctx.close();
server.close();
fs.rmSync(dir, { recursive: true, force: true });
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `${failed} of ${results.length} failed` : `all ${results.length} passed`);
process.exit(failed ? 1 : 0);
