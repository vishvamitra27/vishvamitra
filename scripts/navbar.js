// ============================================================
//  scripts/navbar.js  (v3 — route-driven + localStorage active)
//
//  NAV_ITEMS from core/routes.js drives hrefs (single source).
//  auth.js controls visibility of auth-dependent links.
// ============================================================

import { NAV_ITEMS } from "./core/routes.js";

const HIDDEN_BY_DEFAULT = new Set(["dashboard", "admin", "logout"]);

function buildNavbarHtml() {
  const lis = NAV_ITEMS.map((item) => {
    const hidden = HIDDEN_BY_DEFAULT.has(item.kind) ? ` style="display:none;"` : "";
    const idAttr = item.id ? ` id="${item.id}"` : "";
    return `<li><a href="${item.path}" class="nav-link"${idAttr}${hidden}>${item.label}</a></li>`;
  }).join("\n    ");

  return `
<nav class="navbar" role="navigation" aria-label="Main navigation">
  <a class="logo" href="index.html" aria-label="Vishvamitra Home">Vishvamitra</a>

  <button class="menu-toggle" id="mobile-menu"
          aria-label="Toggle navigation" aria-expanded="false" type="button">
    <span class="bar"></span>
    <span class="bar"></span>
    <span class="bar"></span>
  </button>

  <ul class="nav-list" id="nav-list" role="list">
    ${lis}
  </ul>
</nav>`;
}

const root = document.getElementById("navbar-root");
if (root) root.innerHTML = buildNavbarHtml();

const page = location.pathname.split("/").pop() || "index.html";
try { localStorage.setItem("vm_nav_active", page); } catch { /* quota */ }

document.querySelectorAll(".nav-link").forEach((link) => {
  const href = link.getAttribute("href")?.split("/").pop();
  if (href === page) link.classList.add("active");
});

document.addEventListener("click", (e) => {
  const toggle  = document.getElementById("mobile-menu");
  const navList = document.getElementById("nav-list");
  if (!toggle || !navList) return;

  if (e.target.closest("#mobile-menu")) {
    const isOpen = navList.classList.toggle("active");
    toggle.setAttribute("aria-expanded", String(isOpen));
    return;
  }

  if (!e.target.closest(".navbar")) {
    navList.classList.remove("active");
    toggle.setAttribute("aria-expanded", "false");
  }
}, { passive: true });
