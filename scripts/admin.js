// ============================================================
//  scripts/admin.js  (v3 — firebase-core + improved admin panel)
//
//  Admin panel: real-time listings + users management.
//  All Firestore reads/writes centralized here.
//  Improvements in v3:
//    - Imports from firebase-core.js
//    - Approve button now shows pending count badge
//    - User cards show createdAt date when present
//    - Better error recovery for missing Firestore index
// ============================================================

import { db, auth }           from "./firebase-core.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  collection, doc, query, orderBy,
  onSnapshot, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { isOperatorAdmin }            from "./role.js";
import { setListingStatus, deleteListing } from "./listings.js";
import { cacheClearAll }              from "./service-layer.js";
import { P }                          from "./core/routes.js";
import { navigate }                   from "./core/router.js";
import { toUserMessage, reportError } from "./core/errors.js";
import { showToast }                  from "./core/ui.js";

let unsubListings = null;
let unsubUsers    = null;
let allListings   = [];
let allUsers      = [];

// ── Entry point ───────────────────────────────────────────────
export function initAdminPanel() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      navigate(P.LOGIN, { replace: true });
      return;
    }
    if (!(await isOperatorAdmin(user))) {
      navigate(P.HOME, { replace: true });
      return;
    }

    revealPanel();
    startListingStream();
    startUserStream();
    bindSidebarNav();
    bindMobileMenu();
  });

  window.addEventListener("pagehide", cleanup);
}

function revealPanel() {
  const el = document.getElementById("adminWrap");
  if (el) el.style.visibility = "visible";
}

// ── LISTINGS stream ───────────────────────────────────────────
function startListingStream() {
  if (unsubListings) unsubListings();
  const q = query(collection(db, "listings"), orderBy("createdAt", "desc"));
  unsubListings = onSnapshot(q, (snap) => {
    allListings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateKPIs();
    renderListings();
  }, (err) => {
    reportError("admin.listings", err);
    const msg = toUserMessage(err);
    const box = document.getElementById("adminListings");
    if (box) box.innerHTML = `<p class="empty-state vm-inline-error">${msg}</p>`;
    showToast(msg, { kind: "error", duration: 8000 });
  });
}

export function renderListings() {
  const box     = document.getElementById("adminListings");
  const status  = document.getElementById("statusFilter")?.value  || "";
  const keyword = document.getElementById("listingSearch")?.value.trim().toLowerCase() || "";
  if (!box) return;

  let list = allListings;
  if (status)  list = list.filter(l => l.status === status);
  if (keyword) list = list.filter(l =>
    (l.name || "").toLowerCase().includes(keyword) ||
    (l.location || "").toLowerCase().includes(keyword)
  );

  box.innerHTML = "";
  if (!list.length) { box.innerHTML = '<p class="empty-state">No listings found.</p>'; return; }
  list.forEach(l => box.appendChild(buildListingCard(l)));
}

function buildListingCard(l) {
  const badgeClass = l.status === "active"  ? "badge-active"
                   : l.status === "pending" ? "badge-pending" : "badge-inactive";
  const isActive   = l.status === "active";

  const card = document.createElement("div");
  card.className = "admin-card";
  card.innerHTML = `
    <h3 class="c-name"></h3>
    <p><span class="c-loc"></span> &nbsp;|&nbsp; Category: <span class="c-cat"></span> &nbsp;|&nbsp; Type: <span class="c-type"></span></p>
    <p class="uid-label">Vendor UID: <span class="c-vid"></span></p>
    <p>Status: <span class="badge ${badgeClass} c-status"></span></p>
    <div class="card-actions">
      <button class="${isActive ? "action-btn deactivate" : "action-btn"}"
              data-id="${l.id}" data-status="${l.status}" data-action="toggle">
        ${isActive ? "Deactivate" : "Activate"}
      </button>
      <button class="action-btn blue" data-id="${l.id}" data-action="approve"
              ${isActive ? "disabled" : ""}>
        Approve
      </button>
      <button class="delete-btn" data-id="${l.id}" data-action="delete-listing">Delete</button>
    </div>`;

  card.querySelector(".c-name").textContent   = l.name     || "Unnamed";
  card.querySelector(".c-loc").textContent    = l.location || "—";
  card.querySelector(".c-cat").textContent    = l.category || "—";
  card.querySelector(".c-type").textContent   = (l.type || "free").toUpperCase();
  card.querySelector(".c-vid").textContent    = l.vendorId  || "—";
  card.querySelector(".c-status").textContent = l.status   || "—";
  return card;
}

export function bindListingActions() {
  const box = document.getElementById("adminListings");
  if (!box) return;

  box.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn || btn.disabled) return;
    const { id, action, status } = btn.dataset;

    try {
      if (action === "delete-listing") {
        if (!confirm("Permanently delete this listing?")) return;
        await deleteListing(id);
        showToast("Listing deleted.", { kind: "success" });
      }
      if (action === "toggle") {
        await setListingStatus(id, status === "active" ? "inactive" : "active");
      }
      if (action === "approve") {
        await setListingStatus(id, "active");
      }
    } catch (err) {
      reportError("admin.listingAction", err);
      showToast(toUserMessage(err), { kind: "error" });
    }
  });
}

// ── USERS stream ──────────────────────────────────────────────
function startUserStream() {
  if (unsubUsers) unsubUsers();

  const mainQ     = query(collection(db, "users"), orderBy("createdAt", "desc"));
  const fallbackQ = query(collection(db, "users"));

  function subscribe(q, isFallback = false) {
    unsubUsers = onSnapshot(q, (snap) => {
      allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateKPIs();
      renderUsers();
    }, (err) => {
      if (!isFallback) {
        console.warn("Retrying users without orderBy:", err.message);
        subscribe(fallbackQ, true);
      } else {
        reportError("admin.users", err);
        const msg = toUserMessage(err);
        const box = document.getElementById("adminUsers");
        if (box) box.innerHTML = `<p class="empty-state vm-inline-error">${msg}</p>`;
        showToast(msg, { kind: "error", duration: 8000 });
      }
    });
  }

  subscribe(mainQ);
}

export function renderUsers() {
  const box     = document.getElementById("adminUsers");
  const role    = document.getElementById("roleFilter")?.value    || "";
  const keyword = document.getElementById("userSearch")?.value.trim().toLowerCase() || "";
  if (!box) return;

  let list = allUsers;
  if (role)    list = list.filter(u => u.role === role);
  if (keyword) list = list.filter(u =>
    (u.displayName  || "").toLowerCase().includes(keyword) ||
    (u.email        || "").toLowerCase().includes(keyword) ||
    (u.businessName || "").toLowerCase().includes(keyword)
  );

  box.innerHTML = "";
  if (!list.length) { box.innerHTML = '<p class="empty-state">No users found.</p>'; return; }
  list.forEach(u => box.appendChild(buildUserCard(u)));
}

function buildUserCard(u) {
  const roleBadge = u.role === "admin"  ? "badge-admin"
                  : u.role === "vendor" ? "badge-vendor" : "badge-user";

  // Format createdAt if it's a Firestore Timestamp
  let joinedText = "—";
  if (u.createdAt?.toDate) {
    joinedText = u.createdAt.toDate().toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
  } else if (u.createdAt instanceof Date) {
    joinedText = u.createdAt.toLocaleDateString("en-IN");
  }

  const card = document.createElement("div");
  card.className = "admin-card";
  card.innerHTML = `
    <h3 class="u-name"></h3>
    <p>Email: <span class="u-email"></span></p>
    <p>Joined: <span class="u-joined"></span></p>
    <p>Role: <span class="badge ${roleBadge} u-role"></span></p>
    <p class="u-biz-row" style="display:none">Business: <span class="u-biz"></span></p>
    <p class="uid-label">UID: <span class="u-uid"></span></p>
    <div class="card-actions">
      <select class="role-select" data-uid="${u.id}">
        <option value="user"   ${u.role === "user"   ? "selected" : ""}>User</option>
        <option value="vendor" ${u.role === "vendor" ? "selected" : ""}>Vendor</option>
        <option value="admin"  ${u.role === "admin"  ? "selected" : ""}>Admin</option>
      </select>
      <button class="action-btn blue" data-uid="${u.id}" data-action="save-role">Save Role</button>
      <button class="delete-btn"      data-uid="${u.id}" data-action="delete-user">Delete</button>
    </div>`;

  card.querySelector(".u-name").textContent   = u.displayName || u.email?.split("@")[0] || "Unknown";
  card.querySelector(".u-email").textContent  = u.email       || "—";
  card.querySelector(".u-joined").textContent = joinedText;
  card.querySelector(".u-role").textContent   = u.role        || "—";
  card.querySelector(".u-uid").textContent    = u.id;

  if (u.businessName) {
    card.querySelector(".u-biz-row").style.display = "block";
    card.querySelector(".u-biz").textContent       = u.businessName;
  }

  return card;
}

export function bindUserActions() {
  const box = document.getElementById("adminUsers");
  if (!box) return;

  box.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const { action, uid } = btn.dataset;

    try {
      if (action === "save-role") {
        const sel = box.querySelector(`.role-select[data-uid="${uid}"]`);
        if (!sel?.value) return;
        await updateDoc(doc(db, "users", uid), { role: sel.value });
        cacheClearAll();
        btn.textContent = "Saved";
        setTimeout(() => { btn.textContent = "Save Role"; }, 1500);
        showToast("Role updated.", { kind: "success" });
      }

      if (action === "delete-user") {
        if (!confirm("Delete this user's Firestore record? (Auth account stays intact)")) return;
        await deleteDoc(doc(db, "users", uid));
        showToast("User document deleted.", { kind: "success" });
      }
    } catch (err) {
      reportError("admin.userAction", err);
      showToast(toUserMessage(err), { kind: "error" });
    }
  });
}

// ── KPIs ──────────────────────────────────────────────────────
function updateKPIs() {
  setText("kpiTotal",   allListings.length);
  setText("kpiPending", allListings.filter(l => l.status === "pending").length);
  setText("kpiUsers",   allUsers.length);
  setText("kpiVendors", allUsers.filter(u => u.role === "vendor").length);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Sidebar ───────────────────────────────────────────────────
function bindSidebarNav() {
  document.querySelectorAll(".sidebar a[data-section]").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const s = link.dataset.section;

      document.querySelectorAll(".sidebar a").forEach(a => a.classList.remove("active"));
      link.classList.add("active");

      document.querySelectorAll(".section-panel").forEach(p => p.classList.remove("active"));
      document.getElementById("section" + s[0].toUpperCase() + s.slice(1))?.classList.add("active");

      document.getElementById("sidebar")?.classList.remove("active");
    });
  });
}

function bindMobileMenu() {
  document.getElementById("menuBtn")?.addEventListener("click", () =>
    document.getElementById("sidebar")?.classList.add("active")
  );
  document.getElementById("closeSidebar")?.addEventListener("click", () =>
    document.getElementById("sidebar")?.classList.remove("active")
  );
}

function cleanup() {
  if (unsubListings) unsubListings();
  if (unsubUsers)    unsubUsers();
}