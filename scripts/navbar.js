// ============================================================
//  scripts/navbar.js  (v5 — pro mobile drawer, fixed)
// ============================================================

import { NAV_ITEMS } from "./core/routes.js";

const HIDDEN_BY_DEFAULT = new Set(["dashboard", "admin", "logout"]);

const NAV_ICONS = {
  Home:      `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><polyline points="9 21 9 12 15 12 15 21"/></svg>`,
  Services:  `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  Contact:   `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  Dashboard: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
  Admin:     `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  Login:     `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`,
  Logout:    `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
};

// ── 1. Build & inject navbar (desktop) ───────────────────────
const desktopLis = NAV_ITEMS.map((item) => {
  const hidden = HIDDEN_BY_DEFAULT.has(item.kind) ? ` style="display:none;"` : "";
  const idAttr = item.id ? ` id="${item.id}"` : "";
  return `<li><a href="${item.path}" class="nav-link"${idAttr}${hidden}>${item.label}</a></li>`;
}).join("\n    ");

const navbarHtml = `
<nav class="navbar" role="navigation" aria-label="Main navigation">

  <!-- Logo: round icon + wordmark -->
  <a class="logo" href="index.html" aria-label="Vishvamitra Home">
    <span class="logo-icon" aria-hidden="true">
      <svg width="26" height="18" viewBox="0 0 52 34" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- V: clean chevron -->
        <path d="M1 3 L8 3 L14 20 L20 3 L27 3 L17 31 L11 31 Z" fill="#fff"/>
        <!-- M: bold peaks -->
        <path d="M28 31 L28 3 L34 3 L40 17 L46 3 L52 3 L52 31 L46 31 L46 14 L41 26 L39 26 L34 14 L34 31 Z" fill="#fff"/>
      </svg>
    </span>
    <span class="logo-word">vishvamitra</span>
  </a>

  <!-- Desktop nav links -->
  <ul class="nav-list" id="nav-list" role="list">
    ${desktopLis}
  </ul>

  <!-- Right side: CTA + hamburger -->
  <div class="navbar-right">
    <a href="contact.html" class="nav-cta" id="navCtaBtn">List Your Business</a>
    <button class="menu-toggle" id="mobile-menu"
            aria-label="Open navigation menu"
            aria-expanded="false"
            aria-controls="nav-drawer"
            type="button">
      <span class="bar"></span>
      <span class="bar"></span>
      <span class="bar"></span>
    </button>
  </div>

</nav>`;

const root = document.getElementById("navbar-root");
if (root) root.innerHTML = navbarHtml;

// ── 2. Build & inject drawer + backdrop at <body> level ───────
//    (must be at body level — not inside <header> — for correct
//     z-index stacking and fixed positioning)

const drawerLis = NAV_ITEMS.map((item) => {
  const hidden = HIDDEN_BY_DEFAULT.has(item.kind) ? ` style="display:none;"` : "";
  const idAttr = item.id ? ` id="d-${item.id}"` : "";
  const icon   = NAV_ICONS[item.label] || NAV_ICONS.Home;
  return `
    <li${hidden}>
      <a href="${item.path}" class="nav-drawer-link"${idAttr}>
        <span class="nav-drawer-icon">${icon}</span>
        <span class="nav-drawer-label">${item.label}</span>
        <svg class="nav-drawer-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
      </a>
    </li>`;
}).join("\n");

const drawerHtml = `
<div class="nav-drawer-backdrop" id="nav-backdrop" aria-hidden="true"></div>
<div class="nav-drawer" id="nav-drawer" role="dialog" aria-modal="true" aria-label="Navigation menu">

  <div class="nav-drawer-header">
    <div>
      <a href="index.html" class="nav-drawer-logo"><span style="color:#fff;">VISHVA</span><span style="color:#14a800;">MITRA</span></a>
      <div class="nav-drawer-tagline">Hyperlocal Services Directory</div>
    </div>
    <button class="nav-drawer-close" id="drawer-close" aria-label="Close menu">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  </div>

  <ul class="nav-drawer-list" role="list">
    ${drawerLis}
    <div class="nav-drawer-divider"></div>
  </ul>

  <div class="nav-drawer-footer">
    <a href="contact.html" class="nav-drawer-cta">List Your Business — It's Free</a>
    <div class="nav-drawer-socials">
      <a href="https://www.facebook.com/profile.php?id=61585787019425"
         target="_blank" rel="noopener noreferrer"
         class="nav-drawer-social" aria-label="Facebook">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877f2">
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
        </svg>
      </a>
      <a href="https://www.instagram.com/vishvamitra_services/"
         target="_blank" rel="noopener noreferrer"
         class="nav-drawer-social" aria-label="Instagram">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round">
          <defs>
            <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%"   stop-color="#f09433"/>
              <stop offset="50%"  stop-color="#dc2743"/>
              <stop offset="100%" stop-color="#bc1888"/>
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-grad)"/>
          <circle cx="12" cy="12" r="4" stroke="url(#ig-grad)"/>
          <circle cx="17.5" cy="6.5" r="1" fill="#dc2743"/>
        </svg>
      </a>
    </div>
  </div>

</div>`;

document.body.insertAdjacentHTML("beforeend", drawerHtml);

// ── 3. Active link highlighting ───────────────────────────────
const page = location.pathname.split("/").pop() || "index.html";
try { localStorage.setItem("vm_nav_active", page); } catch { /* quota */ }

document.querySelectorAll(".nav-link, .nav-drawer-link").forEach((link) => {
  const href = link.getAttribute("href")?.split("/").pop();
  if (href === page) link.classList.add("active");
});

// ── 4. Drawer open / close ────────────────────────────────────
const toggle   = document.getElementById("mobile-menu");
const drawer   = document.getElementById("nav-drawer");
const backdrop = document.getElementById("nav-backdrop");
const closeBtn = document.getElementById("drawer-close");

function openDrawer() {
  drawer.classList.add("open");
  backdrop.classList.add("open");
  toggle.classList.add("open");
  toggle.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";
}

function closeDrawer() {
  drawer.classList.remove("open");
  backdrop.classList.remove("open");
  toggle.classList.remove("open");
  toggle.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
}

toggle?.addEventListener("click", (e) => {
  e.stopPropagation();
  drawer.classList.contains("open") ? closeDrawer() : openDrawer();
});

closeBtn?.addEventListener("click", closeDrawer);
backdrop?.addEventListener("click", closeDrawer);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && drawer?.classList.contains("open")) closeDrawer();
});

drawer?.querySelectorAll(".nav-drawer-link").forEach((link) => {
  link.addEventListener("click", () => {
    if (link.getAttribute("href") !== "#") closeDrawer();
  });
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 768) closeDrawer();
}, { passive: true });

// ── 5. Auth sync helper (called by auth.js) ───────────────────
//    auth.js calls updateNavbar(user, role) which sets display on
//    desktop links by ID. We mirror those same changes to the
//    drawer counterparts here via a shared helper.

export function syncDrawerLink(id, display) {
  const li = document.getElementById(`d-${id}`)?.closest("li");
  if (li) li.style.display = display;
}