// ============================================================
//  scripts/utils.js  (v3.1 — circular dep removed)
//
//  Pure UI + logic helpers. No Firebase imports.
//  clearProfileCache is defined HERE (not re-exported from auth.js)
//  to avoid circular dependency:
//    utils.js ← auth.js ← role.js (was circular via re-export)
// ============================================================

import { cacheClearAll } from "./service-layer.js";
import { authCodeToMessage, toUserMessage, reportError } from "./core/errors.js";
import { showToast } from "./core/ui.js";

export { cacheClearAll, toUserMessage, reportError, showToast };

// ── Profile cache clear (mirrors auth.js implementation) ─────
// Both auth.js and utils.js use the same localStorage key.
// Keeping them in sync is safe because the key is a constant.
const PROFILE_CACHE_KEY = "vm_profile";

export function clearProfileCache() {
  try { localStorage.removeItem(PROFILE_CACHE_KEY); } catch { /* ok */ }
}

// ── Auth error messages (delegates to core/errors) ────────────
export function friendlyAuthError(code) {
  return authCodeToMessage(code);
}

// ── Error element helpers ─────────────────────────────────────
export function showError(el, message) {
  if (!el) return;
  el.textContent   = message;
  el.style.display = "block";
}

export function hideError(el) {
  if (!el) return;
  el.textContent   = "";
  el.style.display = "none";
}

// ── Button state helpers ──────────────────────────────────────
export function setButtonLoading(btn, text) {
  btn.disabled    = true;
  btn.textContent = text;
}

export function resetButton(btn, text) {
  btn.disabled    = false;
  btn.textContent = text;
}

// ── Link prefetch ─────────────────────────────────────────────
export function prefetchPage(href) {
  if (!document.head.querySelector(`link[rel="prefetch"][href="${href}"]`)) {
    const l = document.createElement("link");
    l.rel   = "prefetch";
    l.href  = href;
    document.head.appendChild(l);
  }
}

export function initPrefetch() {
  document.querySelectorAll("a[href$='.html']").forEach(link => {
    link.addEventListener("mouseenter", () => prefetchPage(link.href), { passive: true });
  });
}

// ── Ugadi popup ───────────────────────────────────────────────
export function initUgadiPopup(overlayId) {
  if (localStorage.getItem("ugadiShown")) return;
  setTimeout(() => {
    const el = document.getElementById(overlayId);
    if (el) {
      el.classList.add("show");
      localStorage.setItem("ugadiShown", "true");
    }
  }, 600);
}

export function closePopup(overlayId) {
  document.getElementById(overlayId)?.classList.remove("show");
}
