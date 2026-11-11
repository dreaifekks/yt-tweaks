// Writes the extension for each browser into dist/. There's nothing to compile: it copies
// the files and adjusts the manifest. With --package it also zips the Chrome one into
// packages/. The Safari one becomes a dmg with scripts/package-safari.sh.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["LICENSE", "defaults.js", "settings.js", "filter.js", "grid.js", "speed.js", "content.css", "popup.html", "popup.css", "popup.js"];

const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));

const targets = {
  chrome: manifest,
  safari: {
    ...manifest,
    // The macOS app that carries the extension takes its icon from the largest one here.
    icons: { ...manifest.icons, 1024: "icons/icon-1024.png" },
    // Content scripts in the page's own world need Safari 18.
    browser_specific_settings: { safari: { strict_min_version: "18.0" } },
  },
};

rmSync(join(root, "dist"), { recursive: true, force: true });
for (const [name, content] of Object.entries(targets)) {
  const dir = join(root, "dist", name);
  mkdirSync(join(dir, "icons"), { recursive: true });
  for (const file of [...FILES, ...Object.values(content.icons)]) cpSync(join(root, file), join(dir, file));
  writeFileSync(join(dir, "manifest.json"), `${JSON.stringify(content, null, 2)}\n`);
}

if (process.argv.includes("--package")) {
  const label = (process.env.RELEASE_TAG || "").replace(/^v/, "") || manifest.version;
  mkdirSync(join(root, "packages"), { recursive: true });
  const zip = join(root, "packages", `yt-tweaks-${label}-chrome.zip`);
  rmSync(zip, { force: true });
  execFileSync("zip", ["-qr", zip, "."], { cwd: join(root, "dist", "chrome") });
  console.log(zip);
}
