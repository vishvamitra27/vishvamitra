import { P } from "./routes.js";

/**
 * Current page filename (e.g. `index.html`). Works when the app is served from /pages/.
 */
export function currentFilename() {
  const seg = location.pathname.split("/").pop();
  if (!seg || seg === "") return P.HOME;
  if (seg.includes(".")) return seg;
  return P.HOME;
}

/**
 * Client navigation (MPA). Prefer this over raw `location.*` so redirects stay consistent.
 * @param {string} filename - target HTML file (same folder as current page)
 * @param {{ replace?: boolean }} [opts]
 */
export function navigate(filename, opts = {}) {
  if (currentFilename() === filename) return;
  if (opts.replace) location.replace(filename);
  else location.assign(filename);
}
