// ============================================================
//  scripts/dashboard.js  (v3 — firebase-core + onclick removed)
//
//  Vendor dashboard: renders listings, KPIs, edit/delete actions.
//  Zero Firebase SDK calls here — all data flows through listings.js
// ============================================================

import { auth }                                     from "./firebase-core.js";
import { onAuthStateChanged }                       from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { subscribeToVendorListings, deleteListing } from "./listings.js";
import { P }                                        from "./core/routes.js";
import { navigate }                                 from "./core/router.js";
import { toUserMessage, reportError }               from "./core/errors.js";
import { showToast }                                from "./core/ui.js";

let unsubListings = null;

// ── Entry point ───────────────────────────────────────────────
export function initVendorDashboard() {
  onAuthStateChanged(auth, (user) => {
    if (!user) return; // auth.js handles the redirect

    revealContent();
    setWelcomeName(user);
    loadListings(user.uid);
  });

  window.addEventListener("pagehide", cleanup);
}

// ── UI helpers ────────────────────────────────────────────────
function revealContent() {
  const el = document.getElementById("dashMain");
  if (el) el.style.visibility = "visible";
}

function setWelcomeName(user) {
  const el = document.getElementById("user-name");
  if (el) el.textContent = user.displayName || user.email?.split("@")[0] || "Vendor";
}

function updateKPIs(listings) {
  setText("total-listings",  listings.length);
  setText("active-listings", listings.filter(l => l.status === "active").length);
  setText("review-listings", listings.filter(l => l.status === "pending").length);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ── Listings rendering ────────────────────────────────────────
function loadListings(vendorId) {
  if (unsubListings) unsubListings();

  const container = document.getElementById("listings-container");
  if (!container) return;

  unsubListings = subscribeToVendorListings(vendorId, (listings) => {
    container.innerHTML = "";
    updateKPIs(listings);

    if (listings.length === 0) { renderEmpty(container); return; }
    listings.forEach(l => container.appendChild(buildCard(l)));
  });
}

function renderEmpty(container) {
  // ✅ No onclick= — button is wired via bindCardActions delegation
  container.innerHTML = `
    <div class="empty-state">
      <h3>No listings yet</h3>
      <p>Create your first listing to appear here.</p>
      <button class="btn-primary" id="emptyAddBtn">Add listing</button>
    </div>`;

  // Wire the empty-state button without inline onclick
  document.getElementById("emptyAddBtn")
    ?.addEventListener("click", () => navigate(P.ADD_LISTING));
}

function buildCard(l) {
  const statusClass = l.status === "active"  ? "status-active"
                    : l.status === "pending" ? "status-review" : "";

  const card = document.createElement("div");
  card.className = "listing-card";
  card.innerHTML = `
    <h3 class="card-name"></h3>
    <p>Category: <span class="card-cat"></span></p>
    <p><span class="card-type-badge"></span></p>
    <p>Location: <span class="card-loc"></span></p>
    <p>Status: <span class="status-tag ${statusClass} card-status"></span></p>
    <div class="card-actions">
      <button class="btn-edit"   data-id="${l.id}">✏ Edit</button>
      <button class="btn-delete" data-id="${l.id}">🗑 Delete</button>
    </div>`;

  card.querySelector(".card-name").textContent       = l.name     || "";
  card.querySelector(".card-cat").textContent        = l.category || "";
  card.querySelector(".card-type-badge").textContent = (l.type || "free").toUpperCase();
  card.querySelector(".card-loc").textContent        = l.location || "";
  card.querySelector(".card-status").textContent     = l.status   || "";

  return card;
}

// ── Action delegation ─────────────────────────────────────────
export function bindCardActions(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-id]");
    if (!btn) return;
    const { id } = btn.dataset;

    if (btn.classList.contains("btn-edit")) {
      navigate(`${P.ADD_LISTING}?editId=${encodeURIComponent(id)}`);
    }

    if (btn.classList.contains("btn-delete")) {
      if (!confirm("Permanently delete this listing?")) return;
      try {
        await deleteListing(id);
        showToast("Listing removed.", { kind: "success" });
      } catch (err) {
        reportError("dashboard.deleteListing", err);
        showToast(toUserMessage(err), { kind: "error" });
      }
    }
  });
}

function cleanup() {
  if (unsubListings) unsubListings();
}
