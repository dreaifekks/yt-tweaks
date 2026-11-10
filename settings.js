// Runs in the extension's own world, the only one that can read its storage, and copies the
// settings onto <html> as data-ytt-* attributes: content.css keys its rules on them, and the
// grid and speed scripts, which run in YouTube's world, read their numbers from them.
// A switch that is on is an attribute that is there. Copied again whenever the popup changes one.
(() => {
  const publish = (values) => {
    for (const [key, value] of Object.entries(values)) {
      const name = `ytt${key[0].toUpperCase()}${key.slice(1)}`;
      if (value === false) delete document.documentElement.dataset[name];
      else document.documentElement.dataset[name] = value === true ? "" : value;
    }
  };

  chrome.storage.local.get(YTT_DEFAULTS).then(publish);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") publish(Object.fromEntries(Object.entries(changes).map(([key, change]) => [key, change.newValue])));
  });
})();
