// The settings behind the toolbar icon. Every change is saved at once, and open YouTube tabs
// pick it up without a reload.
const store = chrome.storage.local;

store.get(YTT_DEFAULTS).then((settings) => {
  for (const [key, value] of Object.entries(settings)) {
    const input = document.getElementById(key);
    if (input.type === "checkbox") {
      input.checked = value;
      input.addEventListener("change", () => store.set({ [key]: input.checked }));
    } else {
      input.value = value;
      input.addEventListener("change", () => store.set({ [key]: Number(input.value) }));
    }
  }
});
