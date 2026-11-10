// Videos per row, on the home page and the other grids built the same way (subscriptions,
// channel pages): as many as fit with every card at least the chosen width, up to the chosen
// most. The cards stretch to fill the row. YouTube's own count comes from a minimum card
// width the server sends (360 px as of 2026-11), which leaves most windows with three large
// cards per row.
// Runs in YouTube's own world, where the grid's code is.
(() => {
  const GAP = 16; // the space YouTube puts between cards
  const html = document.documentElement;
  const columns = (width) => Math.min(Number(html.dataset.yttMaxColumns), Math.max(1, Math.floor((width + GAP) / (Number(html.dataset.yttCardWidth) + GAP))));

  customElements.whenDefined("ytd-rich-grid-renderer").then(() => {
    const proto = Object.getPrototypeOf(document.createElement("ytd-rich-grid-renderer").polymerController);
    const refresh = proto.refreshGridLayout;

    // YouTube's refresh works out a count of its own, compares it with elementsPerRow, and
    // when they differ stores it there, lays the items out again and sets
    // --ytd-rich-grid-items-per-row from elementsPerRow. For the length of the call
    // elementsPerRow is ours to answer: up to YouTube's assignment it reads as the count
    // YouTube stored last time, so nothing is laid out again unless something changed, and
    // from the assignment on it reads as our count, which is what gets laid out.
    proto.refreshGridLayout = function (force, ...rest) {
      // The width the cards share: the grid's, less its side margins.
      const width = this.adjustRichGridWidth(this.hostElement.clientWidth, true);
      const perRow = columns(width);
      // A grid on a page that isn't showing has no width; and the settings may not have arrived.
      if (!(width > 0) || !perRow) return refresh.call(this, force, ...rest);
      const changed = this.elementsPerRow !== perRow;
      let stored = false;
      Object.defineProperty(this, "elementsPerRow", {
        configurable: true,
        get: () => (stored ? perRow : this.yttOwnCount),
        set: (count) => {
          this.yttOwnCount = count;
          stored = true;
        },
      });
      const result = refresh.call(this, force || changed, ...rest);
      delete this.elementsPerRow;
      this.elementsPerRow = perRow;
      return result || changed;
    };

    // A new width or most from the popup, or the settings arriving after the grid: lay out again.
    new MutationObserver(() => {
      for (const el of document.querySelectorAll("ytd-rich-grid-renderer")) {
        const grid = el.polymerController;
        if (grid.refreshGridLayout()) grid.updateRichItemGridPositions();
      }
    }).observe(html, { attributeFilter: ["data-ytt-card-width", "data-ytt-max-columns"] });
  });
})();
