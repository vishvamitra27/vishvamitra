// ============================================================
//  scripts/auth.js  (v4 — core routes + router + profile errors)
//
//  Uses core/routes.js for page sets and role → dashboard map.
//  Uses core/router.js for all redirects.
//  Profile fetch failures surface a toast (network / permissions).
// ============================================================

import { auth }                        from "./firebase-core.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { getUserProfile } from "./role.js";
import { P, DASHBOARD_BY_ROLE, ROUTE_GROUPS } from "./core/routes.js";
import { navigate, currentFilename } from "./core/router.js";
import { toUserMessage, reportError } from "./core/errors.js";
import { showToast } from "./core/ui.js";

const CACHE_KEY = "vm_profile";
const CACHE_TTL = 5 * 60 * 1000;

function getCachedProfile() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(CACHE_KEY); return null; }
    return data;
  } catch { return null; }
}

function setCachedProfile(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); }
  catch { /* quota */ }
}

export function clearProfileCache() {
  localStorage.removeItem(CACHE_KEY);
}

function redirect(filename) {
  navigate(filename, { replace: true });
}

function updateNavbar(user, role) {
  const $ = (id) => document.getElementById(id);
  if (user) {
    $("loginLink")?.style.setProperty("display", "none");
    $("logoutLink")?.style.setProperty("display", "inline-block");
    // Dashboard link only for vendors and users — admins use the Admin panel
    $("dashboardLink")?.style.setProperty("display", role === "admin" ? "none" : "inline-block");
    $("adminLink")?.style.setProperty("display", role === "admin" ? "inline-block" : "none");
  } else {
    $("loginLink")?.style.setProperty("display", "inline-block");
    $("logoutLink")?.style.setProperty("display", "none");
    $("dashboardLink")?.style.setProperty("display", "none");
    $("adminLink")?.style.setProperty("display", "none");
  }
}

onAuthStateChanged(auth, async (user) => {
  const page = currentFilename();

  if (!user) {
    clearProfileCache();
    updateNavbar(null, null);
    if (ROUTE_GROUPS.restricted.has(page)) redirect(P.LOGIN);
    return;
  }

  let role    = null;
  let profile = null;

  // Always fetch role from Firestore — single source of truth.
  // Vendor setup: skip cache to avoid stale businessName bypassing setup flow.
  const skipProfileCache = page === P.VENDOR_SETUP;

  if (!skipProfileCache) {
    profile = getCachedProfile();
    if (profile && profile._uid !== user.uid) profile = null;
  }

  if (!profile) {
    try {
      profile = await getUserProfile(user.uid);
      if (profile) setCachedProfile({ ...profile, _uid: user.uid });
    } catch (err) {
      reportError("auth.getUserProfile", err);
      showToast(toUserMessage(err), { kind: "error", duration: 7000 });
      updateNavbar(user, null);
      if (ROUTE_GROUPS.restricted.has(page)) redirect(P.HOME);
      return;
    }
  }

  if (!profile || !profile.role) {
    updateNavbar(user, null);
    if (!ROUTE_GROUPS.onboarding.has(page)) redirect(P.ROLE_SELECT);
    return;
  }

  role = profile.role;

  if (role === "vendor" && !profile.businessName) {
    updateNavbar(user, role);
    if (page !== P.VENDOR_SETUP) {
      clearProfileCache();
      redirect(P.VENDOR_SETUP);
    }
    return;
  }

  updateNavbar(user, role);

  const dash = DASHBOARD_BY_ROLE[role];
  if (page === P.LOGIN || page === P.SIGNUP) { redirect(dash); return; }
  if (page === P.ROLE_SELECT)               { redirect(dash); return; }
  if (ROUTE_GROUPS.dashboards.has(page) && page !== dash) { redirect(dash); return; }
});

document.addEventListener("click", async (e) => {
  const t = e.target;
  const isLogout =
    t.id === "logoutLink" ||
    t.id === "logoutBtn"  ||
    (t.id === "loginLogout" && t.textContent.trim() === "Logout");
  if (!isLogout) return;

  e.preventDefault();
  clearProfileCache();
  try { await signOut(auth); } finally { redirect(P.HOME); }
});