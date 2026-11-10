// Playback speed at hand:
//   a button in the player's control bar showing the speed: wheel up or down over it for
//   faster or slower, click to switch between 1× and the last other speed
//   Ctrl + wheel anywhere over the video does the same as the wheel on the button
//   ] faster, [ slower
// The speed goes through YouTube's own player API, so YouTube keeps it for the next video
// and its settings menu shows it. Runs in YouTube's world, where that API is.
(() => {
  const html = document.documentElement;
  const LAST = "ytt-last-speed"; // localStorage key of the last speed other than 1×
  const REPEAT = 200; // ms between steps while a scroll goes on
  let stepAt = -Infinity;
  let toastTimer = 0;

  const setting = (name) => Number(html.dataset[name]);
  const player = () => document.getElementById("movie_player");
  const label = (rate) => `${Number(rate.toFixed(2))}×`;

  const toast = (p, text) => {
    let box = p.querySelector(".ytt-toast");
    if (!box) {
      box = document.createElement("div");
      box.className = "ytt-toast";
      p.append(box);
    }
    box.textContent = text;
    box.classList.add("ytt-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove("ytt-show"), 800);
  };

  const remember = (rate) => {
    if (rate !== 1) localStorage.setItem(LAST, rate);
  };

  const setRate = (p, rate) => {
    p.setPlaybackRate(Math.min(setting("yttSpeedMax"), Math.max(setting("yttSpeedMin"), Math.round(rate * 100) / 100)));
    const actual = p.getPlaybackRate(); // YouTube keeps it within what it offers for the video
    remember(actual);
    toast(p, label(actual));
  };

  const step = (p, direction) => setRate(p, p.getPlaybackRate() + direction * setting("yttSpeedStep"));

  const toggle = (p) => {
    const rate = p.getPlaybackRate();
    if (rate !== 1) {
      remember(rate); // it may have come from YouTube's own menu
      setRate(p, 1);
    } else {
      setRate(p, Number(localStorage.getItem(LAST)) || 1 + setting("yttSpeedStep"));
    }
  };

  // One step per wheel event would race through the range on a trackpad, so a scroll
  // moves one step at once and then one more every REPEAT ms while it goes on.
  // On window, in the capture phase: YouTube stops wheel events over the player before
  // they get to it.
  addEventListener(
    "wheel",
    (e) => {
      const p = e.target.closest("#movie_player");
      if (!p || !e.deltaY || !(e.ctrlKey || e.target.closest(".ytt-speed"))) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.timeStamp - stepAt < REPEAT) return;
      stepAt = e.timeStamp;
      step(p, e.deltaY < 0 ? 1 : -1);
    },
    { passive: false, capture: true },
  );

  const addButton = () => {
    const p = player();
    const box = p && p.querySelector(".ytp-right-controls-left");
    if (!box) return;
    let button = box.querySelector(".ytt-speed");
    if (!button) {
      button = document.createElement("button");
      button.className = "ytp-button ytt-speed";
      button.title = "倍速：滚轮加减，点按在 1× 和上次的倍速间切换；键盘 [ 和 ]";
      button.addEventListener("click", () => toggle(p));
      box.prepend(button);
    }
    button.textContent = label(p.getPlaybackRate());
  };

  document.addEventListener("loadedmetadata", addButton, true);
  addEventListener("yt-navigate-finish", addButton);

  // Changes from anywhere, YouTube's menu and its own < > keys included.
  document.addEventListener(
    "ratechange",
    (e) => {
      const button = e.target.closest("#movie_player")?.querySelector(".ytt-speed");
      if (button) button.textContent = label(e.target.playbackRate);
    },
    true,
  );

  addEventListener(
    "keydown",
    (e) => {
      if ((e.key !== "[" && e.key !== "]") || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.composedPath()[0];
      if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const p = player();
      if (!p || !p.offsetWidth) return; // no video on screen
      e.preventDefault();
      e.stopPropagation();
      step(p, e.key === "]" ? 1 : -1);
    },
    true,
  );
})();
