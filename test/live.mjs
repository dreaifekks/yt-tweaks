// Checks the extension on the real youtube.com, in a visible Chromium with a profile of its
// own. Not part of npm test: it needs the network and YouTube's pages of the day.
//   npm run live               prints ok / FAIL lines and where the screenshots went
//   HEADLESS=1 npm run live    the same without a window
// The profile is kept in the temp folder between runs, logged out. YouTube's home page is
// empty until something was watched, so a fresh profile first plays two videos, muted.
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ext = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
// Chromium names an unpacked extension after its folder's path.
const id = createHash("sha256").update(ext).digest("hex").slice(0, 32).replace(/./g, (c) => "abcdefghijklmnop"[parseInt(c, 16)]);
const profile = path.join(os.tmpdir(), "yt-tweaks-live-profile");
const shots = fs.mkdtempSync(path.join(os.tmpdir(), "yt-tweaks-shots-"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail === "" ? "" : "  " + JSON.stringify(detail)}`);
};

const ctx = await chromium.launchPersistentContext(profile, {
  headless: !!process.env.HEADLESS,
  channel: "chromium",
  locale: "zh-CN",
  viewport: { width: 1662, height: 900 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, "--window-position=40,40", "--mute-audio"],
});
const page = ctx.pages()[0] || (await ctx.newPage());
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

// Start from the default settings, whatever an earlier run left.
const popup = await ctx.newPage();
await popup.goto(`chrome-extension://${id}/popup.html`);
await popup.evaluate(() => chrome.storage.local.clear());
await popup.reload();

const HOME = 'ytd-browse[page-subtype="home"] ytd-rich-grid-renderer > #contents';
const homeItems = () => page.evaluate((sel) => document.querySelectorAll(`${sel} > ytd-rich-item-renderer`).length, HOME);
await page.bringToFront();
await page.goto("https://www.youtube.com/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
if (!(await homeItems())) {
  console.log("fresh profile: playing two videos so the home page has something");
  await page.goto("https://www.youtube.com/results?search_query=" + encodeURIComponent("MacBook 评测"), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const links = await page.evaluate(() => [...document.querySelectorAll("ytd-search ytd-video-renderer a#thumbnail[href^='/watch']")].slice(0, 2).map((a) => a.href));
  for (const href of links) {
    await page.goto(href, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(40000);
  }
  await page.goto("https://www.youtube.com/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
}
// More of the feed, so shelves and mixes are in it.
for (let i = 0; i < 3; i++) {
  await page.mouse.wheel(0, 5000);
  await page.waitForTimeout(2000);
}
await page.evaluate(() => scrollTo(0, 0));

// What an entry is, by where it links. The same reading for the feed and the list beside a video.
const census = (selector) =>
  page.evaluate((selector) => {
    const count = {};
    for (const el of document.querySelector(selector).children) {
      const href = el.querySelector("a[href]")?.getAttribute("href") || "";
      const kind = el.matches("ytd-continuation-item-renderer")
        ? "more"
        : el.querySelector("[is-shorts]") || el.matches("ytd-reel-shelf-renderer")
          ? "shorts"
          : href.startsWith("/playables")
            ? "game"
            : el.matches("ytd-rich-section-renderer")
              ? "shelf"
              : href.startsWith("/shorts/")
                ? "shorts"
              : href.includes("list=")
                ? "list"
                : "video";
      const shown = getComputedStyle(el).display !== "none";
      count[kind] ??= { shown: 0, hidden: 0 };
      count[kind][shown ? "shown" : "hidden"]++;
    }
    return count;
  }, selector);
const onlyVideos = (c) => c.video.shown > 0 && c.video.hidden === 0 && ["shorts", "game", "list", "shelf"].every((kind) => !c[kind]?.shown);

// ---- videos per row --------------------------------------------------------------------
const grid = () =>
  page.evaluate((sel) => {
    const contents = document.querySelector(sel);
    const el = contents.parentElement;
    const rows = new Map();
    let card = 0;
    for (const item of contents.children) {
      if (!item.offsetParent || item.matches("ytd-continuation-item-renderer")) continue;
      const box = item.getBoundingClientRect();
      rows.set(Math.round(box.top), (rows.get(Math.round(box.top)) || 0) + 1);
      card ||= Math.round(box.width);
    }
    const counts = [...rows.values()];
    const g = el.polymerController;
    const width = g.adjustRichGridWidth(el.clientWidth, true);
    const { yttCardWidth, yttMaxColumns } = document.documentElement.dataset;
    return {
      window: innerWidth,
      least: Number(yttCardWidth),
      expected: Math.min(Number(yttMaxColumns), Math.max(1, Math.floor((width + 16) / (Number(yttCardWidth) + 16)))),
      perRow: Number(getComputedStyle(el).getPropertyValue("--ytd-rich-grid-items-per-row")),
      rows: [...new Set(counts.slice(0, -1))], // the last row may be part full
      card,
      filled: Math.round((card * counts[0] + 16 * (counts[0] - 1)) / (el.clientWidth - 48) * 100),
    };
  }, HOME);
// Full rows of the expected count, no gaps where something was taken out, cards across the width.
const gridOk = (s) => s.perRow === s.expected && s.rows.length === 1 && s.rows[0] === s.expected && s.filled > 95 && (s.card >= s.least || s.expected === 1);

const counts = [];
for (const width of [800, 1100, 1300, 1662, 1920, 2560]) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(1500);
  const s = await grid();
  await page.screenshot({ path: path.join(shots, `home-${width}.png`) });
  counts.push(s.perRow);
  check(`home at ${width} px: ${s.expected} per row, cards at least ${s.least} px, every row full`, gridOk(s), s);
}
check("the count goes from 2 up to the most of 5 as the window widens", counts[0] === 2 && counts.at(-1) === 5 && counts.every((n, i) => !i || n >= counts[i - 1]), counts);
await page.setViewportSize({ width: 1662, height: 900 });
await page.waitForTimeout(1200);

// ---- what's taken out of the home feed -------------------------------------------------
let feed = await census(HOME);
check("the home feed shows only videos", onlyVideos(feed), feed);
check("and it had Shorts, a shelf or mixes to take out", Object.entries(feed).some(([kind, c]) => kind !== "video" && c.hidden > 0), feed);

// ---- settings change from the popup, no reload -----------------------------------------
await popup.selectOption("#maxColumns", "3");
await popup.uncheck("#hideShorts");
await popup.uncheck("#hideLists");
await page.bringToFront();
await page.waitForTimeout(1200);
const fewer = await page.evaluate((sel) => Number(getComputedStyle(document.querySelector(sel).parentElement).getPropertyValue("--ytd-rich-grid-items-per-row")), HOME);
check("a lower most from the popup reflows the open page", fewer === 3, fewer);
feed = await census(HOME);
check("switches turned off in the popup bring those entries back at once", !feed.shorts?.hidden && !feed.list?.hidden && !feed.shelf?.shown, feed);
await page.screenshot({ path: path.join(shots, "home-1662-unfiltered-3.png") });
await popup.selectOption("#maxColumns", "5");
await popup.check("#hideShorts");
await popup.check("#hideLists");
await page.bringToFront();
await page.waitForTimeout(800);

// ---- search page (in-page navigation) --------------------------------------------------
await page.locator('input[name="search_query"]').fill("MacBook Air M5");
await page.locator('input[name="search_query"]').press("Enter");
await page.waitForURL(/\/results/);
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(shots, "search.png") });

// ---- watch page ------------------------------------------------------------------------
await page.locator("ytd-search ytd-video-renderer a#thumbnail").first().click();
await page.waitForURL(/\/watch/);
// YouTube builds the player before the first watch page, hidden, so wait until it shows and
// the video itself (not an ad) is playing.
const adFree = async () => {
  for (let i = 0; i < 150; i++) {
    const playing = await page.evaluate(() => {
      const p = document.getElementById("movie_player");
      document.querySelector(".ytp-skip-ad-button, .ytp-ad-skip-button-modern")?.click();
      return p.offsetWidth > 0 && !p.classList.contains("ad-showing") && p.getAvailablePlaybackRates().length > 1 && p.querySelector("video").currentTime > 0;
    });
    if (playing) return true;
    await page.waitForTimeout(1000);
  }
  return false;
};
check("the video plays after any ad", await adFree());
await page.waitForTimeout(2000); // the page is still moving into place as the video starts
const speed = () => page.evaluate(() => ({ rate: document.getElementById("movie_player").getPlaybackRate(), button: document.querySelector("#movie_player .ytp-right-controls-left .ytt-speed")?.textContent }));
const reveal = () => page.mouse.move(700, 300);
await reveal();
check("the speed button sits in the control bar showing 1×", (await speed()).button === "1×", await speed());

const box = await page.locator(".ytt-speed").boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.wheel(0, -100);
await page.waitForTimeout(400);
check("wheel up over the button: 1.25×", (await speed()).rate === 1.25, await speed());
await page.mouse.wheel(0, -100);
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(shots, "watch-speed.png") });
check("again: 1.5×, and the button says so", JSON.stringify(await speed()) === JSON.stringify({ rate: 1.5, button: "1.5×" }), await speed());
await page.mouse.wheel(0, 100);
await page.waitForTimeout(400);
check("wheel down: 1.25×", (await speed()).rate === 1.25, await speed());

await page.keyboard.press("]");
await page.waitForTimeout(200);
check("] raises it to 1.5×", (await speed()).rate === 1.5, await speed());
await page.keyboard.press("[");
await page.keyboard.press("[");
await page.waitForTimeout(200);
check("[ twice: 1×", (await speed()).rate === 1, await speed());
await page.keyboard.press("]");
await page.keyboard.press("]");
await page.keyboard.press("]");
await page.waitForTimeout(200);
check("] three times: 1.75×", (await speed()).rate === 1.75, await speed());

await page.locator(".ytt-speed").click();
await page.waitForTimeout(200);
check("a click goes to 1×", (await speed()).rate === 1, await speed());
await page.locator(".ytt-speed").click();
await page.waitForTimeout(200);
check("another click goes back to 1.75×", (await speed()).rate === 1.75, await speed());

await page.mouse.move(500, 300);
await page.keyboard.down("Control");
await page.mouse.wheel(0, 100);
await page.keyboard.up("Control");
await page.waitForTimeout(300);
check("Ctrl + wheel down over the video: 1.5×", (await speed()).rate === 1.5, await speed());

await page.locator('input[name="search_query"]').press("]");
await page.waitForTimeout(200);
check("] typed into the search box leaves the speed alone", (await speed()).rate === 1.5, await speed());
await page.locator('input[name="search_query"]').fill("");

await page.screenshot({ path: path.join(shots, "watch.png") });

// The next video keeps the speed: YouTube carries over what its own API was given.
const next = await page.evaluate(() => [...document.querySelectorAll("#related a[href^='/watch?v='], ytd-watch-next-secondary-results-renderer a[href^='/watch?v=']")].find((a) => a.offsetParent)?.getAttribute("href"));
if (next) {
  await page.evaluate((href) => document.querySelector(`a[href="${href}"]`).click(), next);
  await page.waitForURL((u) => u.href.includes(next.split("&")[0]));
  await adFree();
  await page.waitForTimeout(1000);
  check("the next video starts at 1.5× too", (await speed()).rate === 1.5, await speed());
} else {
  check("found a related video to open next", false);
}

// ---- the list beside the video ---------------------------------------------------------
const BESIDE = "ytd-watch-next-secondary-results-renderer ytd-item-section-renderer > #contents";
await page.mouse.wheel(0, 3000);
await page.waitForTimeout(2500);
const beside = await census(BESIDE);
check("the list beside the video shows only videos", onlyVideos(beside), beside);
await page.evaluate(() => scrollTo(0, 0));

// ---- back home (in-page navigation) ----------------------------------------------------
await page.locator("ytd-masthead a#logo").first().click();
await page.waitForURL("https://www.youtube.com/");
await page.waitForTimeout(3000);
const again = await grid();
check("back on the home page: the rows are as before", gridOk(again), again);
feed = await census(HOME);
check("and still only videos", onlyVideos(feed), feed);
await page.screenshot({ path: path.join(shots, "home-again.png") });
check("no errors on the page from the extension", !errors.some((e) => e.includes("ytt") || e.includes(id)), errors.slice(0, 3));

await popup.evaluate(() => chrome.storage.local.clear());
await ctx.close();

console.log(`screenshots: ${shots}`);
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `${failed} of ${results.length} failed` : `all ${results.length} passed`);
process.exit(failed ? 1 : 0);
