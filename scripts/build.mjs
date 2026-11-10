// Copies the extension into dist/chrome. There's nothing to compile. With --package it also
// zips it into packages/.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["LICENSE", "manifest.json", "defaults.js", "settings.js", "filter.js", "grid.js", "speed.js", "content.css", "popup.html", "popup.css", "popup.js"];
const ICONS = [16, 32, 48, 128].map((size) => `icons/icon-${size}.png`);

const out = join(root, "dist", "chrome");
rmSync(join(root, "dist"), { recursive: true, force: true });
mkdirSync(join(out, "icons"), { recursive: true });
for (const file of [...FILES, ...ICONS]) cpSync(join(root, file), join(out, file));

if (process.argv.includes("--package")) {
  const { version } = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
  const label = (process.env.RELEASE_TAG || "").replace(/^v/, "") || version;
  mkdirSync(join(root, "packages"), { recursive: true });
  const zip = join(root, "packages", `yt-tweaks-${label}-chrome.zip`);
  rmSync(zip, { force: true });
  execFileSync("zip", ["-qr", zip, "."], { cwd: out });
  console.log(zip);
}
