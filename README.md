# YT Tweaks

A small Chrome extension that changes three things on youtube.com.

- **Videos per row follow the window width.** Two from 768 px, one more for every 256 px, up to a most you choose (5 to start with). The cards stretch to fill the row. This applies to the home page and the other pages laid out the same way, such as subscriptions and channel pages.
- **Only videos among the videos.** The home feed and the list beside a video lose their Shorts, games, mixes, playlists and albums, and the home feed loses the other shelves it puts between videos, such as breaking news. Each of the four groups has its own switch.
- **Playback speed at hand.** A button in the player's control bar shows the speed. Turn the wheel over it for faster or slower, click it to switch between 1× and the last other speed. Ctrl + wheel anywhere over the video does the same, and so do the `]` and `[` keys. The step and the lowest and highest speed are settings.

The settings are behind the toolbar icon. A change applies to open YouTube tabs at once, without a reload.

The extension reads and stores nothing but its own settings, and sends nothing anywhere.

## Install

There's no store listing. To load it from this folder:

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Choose **Load unpacked** and pick this folder, or `dist/chrome` after `npm run build`.

## Notes

- The speed goes through YouTube's own player, so YouTube remembers it for the next video and limits it to what it offers: up to 2×, or 4× with Premium.
- `]` and `[` are left alone while you type in a text box.
- The interface is in Chinese.

## Development

There's nothing to compile. The files in this folder are the extension.

```sh
npm install
npx playwright-core install chromium
npm test          # against a fake youtube.com, no network
npm run live      # against the real site, in a visible Chromium with its own profile
npm run build     # copies the extension into dist/chrome
npm run package   # and zips it into packages/
```

| File | What it does |
|---|---|
| `defaults.js` | The settings and their starting values |
| `settings.js` | Copies the settings from storage onto `<html>` as `data-ytt-*` attributes |
| `content.css` | What's hidden, keyed on those attributes, and the speed button's look |
| `grid.js` | The count of videos per row, inside YouTube's own grid code |
| `speed.js` | The speed button, wheel and keys |
| `popup.*` | The settings behind the toolbar icon |

`grid.js` and `speed.js` run in the page's own world, because they call YouTube's code: the grid's `refreshGridLayout` and the player's `setPlaybackRate`. Both, and the element names in `content.css`, were checked against YouTube on 2026-11-11. When YouTube changes them, `npm run live` is the quickest way to see what broke.
