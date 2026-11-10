// The settings behind the toolbar icon. Every change is saved as it's made, since the popup
// can close at any moment, and open YouTube tabs pick it up without a reload.
const store = chrome.storage.local;

store.get(YTT_DEFAULTS).then((settings) => {
  for (const [key, value] of Object.entries(settings)) {
    const input = document.getElementById(key);
    if (key === "blockWords") {
      input.value = value.join("\n");
      input.addEventListener("input", () => store.set({ blockWords: [...new Set(input.value.split("\n").map((word) => word.trim()).filter(Boolean))] }));
    } else if (input.type === "checkbox") {
      input.checked = value;
      input.addEventListener("change", () => store.set({ [key]: input.checked }));
    } else {
      input.value = value;
      // As it's typed, like the words; a number on its way to one in range isn't one to keep.
      input.addEventListener("input", () => {
        const number = Number(input.value);
        if (!(number < input.min) && !(number > input.max)) store.set({ [key]: number });
      });
    }
  }
});
