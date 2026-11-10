// The settings behind the toolbar icon. Every change is saved at once, and open YouTube tabs
// pick it up without a reload.
const store = chrome.storage.local;

const WORDS_SAVE_DELAY = 500; // ms, so half a word doesn't empty the feed while it's typed

store.get(YTT_DEFAULTS).then((settings) => {
  for (const [key, value] of Object.entries(settings)) {
    const input = document.getElementById(key);
    if (key === "blockWords") {
      let timer = 0;
      const save = () => {
        clearTimeout(timer);
        store.set({ blockWords: [...new Set(input.value.split("\n").map((word) => word.trim()).filter(Boolean))] });
      };
      input.value = value.join("\n");
      input.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(save, WORDS_SAVE_DELAY);
      });
      addEventListener("pagehide", save); // the popup closing
    } else if (input.type === "checkbox") {
      input.checked = value;
      input.addEventListener("change", () => store.set({ [key]: input.checked }));
    } else {
      input.value = value;
      input.addEventListener("change", () => store.set({ [key]: Number(input.value) }));
    }
  }
});
