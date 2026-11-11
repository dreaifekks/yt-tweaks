# YT Tweaks

A small extension for Chrome and Safari that changes a few things on youtube.com.

- **Videos per row follow the window width.** As many as fit with every card at least a width you choose (290 px to start with), up to a most you choose (5 to start with). The cards stretch to fill the row. This applies to the home page and the other pages laid out the same way, such as subscriptions and channel pages.
- **Only videos among the videos.** The home feed and the list beside a video lose their Shorts, games (the "play while you watch" row included), mixes, playlists and albums, and the home feed loses the other shelves it puts between videos, such as breaking news. Each of the four groups has its own switch.
- **Home videos filtered by words.** A list of words takes videos off the home feed when their title or channel name has one of them, whatever the case. An entry written `/like this/` is a regular expression.
- **Playback speed at hand.** A button in the player's control bar shows the speed. Turn the wheel over it for faster or slower, click it to switch between 1× and the last other speed. Ctrl + wheel anywhere over the video does the same, and so do the `]` and `[` keys. The step and the lowest and highest speed are settings.

The settings are behind the toolbar icon. A change applies to open YouTube tabs at once, without a reload.

The extension reads and stores nothing but its own settings, and sends nothing anywhere.

## Install

There's no store listing.

**Chrome.** Load it unpacked:

1. Get the files: clone this repository, or download the zip from a release and unpack it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Choose **Load unpacked** and pick the folder.

**Safari 18 or later, on macOS 14 or later.** Download `yt-tweaks-<version>-safari.dmg` from a release. Drag YT Tweaks into Applications and open it once, then turn it on in Safari's Settings, under Extensions, and allow it on youtube.com.

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
npm run build     # copies the extension into dist/chrome and dist/safari
npm run package   # and zips the Chrome one into packages/
scripts/package-safari.sh packages/yt-tweaks-safari.dmg   # the Safari one as a macOS app in a dmg, needs Xcode
```

Pushing a tag `v<version>`, matching `manifest.json`, builds the zip and the dmg and publishes them as a GitHub Release. Running the Release workflow by hand only builds, leaving them as artifacts. With the secrets `MACOS_SIGNING_P12`, `MACOS_SIGNING_PASSWORD`, `APPLE_API_KEY_P8_BASE64`, `APPLE_API_KEY_ID` and `APPLE_API_ISSUER_ID` the dmg is signed and notarized. Without them it is ad-hoc signed, and Safari only turns the extension on with "Allow Unsigned Extensions" checked.

| File | What it does |
|---|---|
| `defaults.js` | The settings and their starting values |
| `settings.js` | Copies the settings from storage onto `<html>` as `data-ytt-*` attributes |
| `content.css` | What's hidden, keyed on those attributes, and the speed button's look |
| `filter.js` | The word list for the home feed |
| `grid.js` | The count of videos per row, inside YouTube's own grid code |
| `speed.js` | The speed button, wheel and keys |
| `popup.*` | The settings behind the toolbar icon |

`grid.js` and `speed.js` run in the page's own world, because they call YouTube's code: the grid's `refreshGridLayout` and the player's `setPlaybackRate`. Both, and the element names in `content.css`, were checked against YouTube on 2026-11-11. When YouTube changes them, `npm run live` is the quickest way to see what broke.

## License

[MIT](LICENSE)
