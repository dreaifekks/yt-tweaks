// The settings and what they start as. Shared by the content scripts and the popup.
globalThis.YTT_DEFAULTS = {
  // Videos per row: as many as fit with every card at least this wide, in CSS pixels, and
  // never more than the most (grid.js).
  cardWidth: 290,
  maxColumns: 5,
  // What to take out of the home feed and the list beside a video (content.css).
  hideShorts: true,
  hideGames: true,
  hideLists: true, // mixes, playlists and albums
  hideShelves: true, // the other shelves the home feed puts between videos, like breaking news
  speedStep: 0.25,
  speedMin: 0.25,
  speedMax: 4,
};
