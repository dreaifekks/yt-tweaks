// Takes videos off the home feed by their title or channel name. Each entry of the list is
// either plain text, found anywhere in the title or the name whatever the case, or a
// regular expression written /like this/ with flags after the second slash if wanted.
(() => {
  const ITEMS = 'ytd-browse[page-subtype="home"] ytd-rich-grid-renderer > #contents > ytd-rich-item-renderer';
  const GRID = 'ytd-browse[page-subtype="home"] ytd-rich-grid-renderer > #contents';
  const watched = new WeakSet();
  let tests = [];
  let queued = false;

  const compile = (words) =>
    words.flatMap((word) => {
      const pattern = /^\/(.+)\/([a-z]*)$/.exec(word);
      if (!pattern) return [(text) => text.toLowerCase().includes(word.toLowerCase())];
      try {
        const re = new RegExp(pattern[1], pattern[2].replace(/[gy]/g, ""));
        return [(text) => re.test(text)];
      } catch {
        return []; // not a regular expression yet, as while it's being typed
      }
    });

  const apply = () => {
    queued = false;
    for (const item of document.querySelectorAll(ITEMS)) {
      const texts = [item.querySelector("h3"), item.querySelector('a[href^="/@"], a[href^="/channel/"]')].map((el) => (el ? el.textContent.trim() : ""));
      item.toggleAttribute("data-ytt-blocked", tests.some((test) => texts.some((text) => text && test(text))));
    }
  };

  // The feed grows as it's scrolled, and YouTube fills a card in after adding it.
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  });

  const watch = () => {
    const grid = document.querySelector(GRID);
    if (grid && !watched.has(grid)) {
      watched.add(grid);
      observer.observe(grid, { childList: true, subtree: true, characterData: true });
    }
    apply();
  };

  chrome.storage.local.get({ blockWords: YTT_DEFAULTS.blockWords }).then(({ blockWords }) => {
    tests = compile(blockWords);
    document.addEventListener("yt-page-data-updated", watch);
    watch();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.blockWords) return;
    tests = compile(changes.blockWords.newValue);
    apply();
  });
})();
