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

// ─────────────────────────────────────────────────────────────
//  ADS PANEL
// ─────────────────────────────────────────────────────────────

import {
  subscribeToAllAds, addAd, setAdActive, deleteAd, updateAd
} from "./ads.js";

let unsubAds   = null;
let allAds     = [];
let selectedAdFile = null;

export function initAdsPanel() {
  // File picker → preview
  const fileInput = document.getElementById("adFile");
  const fileLabel = document.getElementById("adFileName");
  const previewWrap = document.getElementById("featPreviewWrap");
  const uploadBtn   = document.getElementById("adUploadBtn");

  if (!fileInput) return;

  fileInput.addEventListener("change", () => {
    selectedAdFile = fileInput.files[0] || null;
    if (!selectedAdFile) {
      fileLabel.textContent = "No file chosen";
      previewWrap.style.display = "none";
      uploadBtn.disabled = true;
      return;
    }
    fileLabel.textContent = selectedAdFile.name;
    uploadBtn.disabled = false;

    // Show preview
    previewWrap.style.display = "block";
    previewWrap.innerHTML = "";
    const url = URL.createObjectURL(selectedAdFile);
    if (selectedAdFile.type.startsWith("video/")) {
      previewWrap.innerHTML = `<video src="${url}" controls class="feat-preview-media"></video>`;
    } else {
      previewWrap.innerHTML = `<img src="${url}" alt="preview" class="feat-preview-media" />`;
    }
  });

  // Upload button
  uploadBtn.addEventListener("click", async () => {
    const title  = document.getElementById("adTitle").value.trim();
    const link   = document.getElementById("adLink").value.trim();
    const order  = document.getElementById("adOrder").value;
    const active = document.getElementById("adActive").checked;

    if (!title) { showToast("Please enter an ad title.", { kind: "error" }); return; }
    if (!selectedAdFile) { showToast("Please select a file.", { kind: "error" }); return; }

    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading…";

    const progressBar  = document.getElementById("adUploadProgress");
    const progressFill = document.getElementById("adProgressFill");
    progressBar.style.display = "block";

    try {
      const { auth } = await import("./firebase-core.js");
      const adminId = auth.currentUser?.uid || "admin";

      await addAd(
        { title, link, active, order },
        adminId,
        selectedAdFile,
        (pct) => { progressFill.style.width = pct + "%"; }
      );

      showToast("Ad uploaded successfully!", { kind: "success" });
      // Reset form
      document.getElementById("adTitle").value = "";
      document.getElementById("adLink").value  = "";
      document.getElementById("adOrder").value = "0";
      document.getElementById("adActive").checked = true;
      fileInput.value = "";
      document.getElementById("adFileName").textContent = "No file chosen";
      document.getElementById("featPreviewWrap").style.display = "none";
      selectedAdFile = null;
      uploadBtn.disabled = true;
    } catch (err) {
      reportError("admin.ads.upload", err);
      showToast(toUserMessage(err), { kind: "error", duration: 8000 });
    } finally {
      uploadBtn.textContent = "Upload Ad";
      progressBar.style.display = "none";
      progressFill.style.width = "0%";
    }
  });

  // Subscribe to all ads
  unsubAds = subscribeToAllAds(
    (ads) => { allAds = ads; renderAds(); },
    (err)  => {
      reportError("admin.ads.stream", err);
      showToast(toUserMessage(err), { kind: "error", duration: 8000 });
    }
  );

  window.addEventListener("pagehide", () => { if (unsubAds) unsubAds(); });
}

function renderAds() {
  const box = document.getElementById("adminAdsList");
  if (!box) return;

  if (!allAds.length) {
    box.innerHTML = '<p class="empty-state">No ads yet. Upload one above.</p>';
    return;
  }

  box.innerHTML = "";
  const sorted = [...allAds].sort((a, b) => {
    const aSub = a.source === "submission";
    const bSub = b.source === "submission";
    if (aSub !== bSub) return aSub ? 1 : -1;
    if (aSub) {
      return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);
    }
    return (a.order ?? 9999) - (b.order ?? 9999);
  });
  sorted.forEach(ad => box.appendChild(buildAdCard(ad)));
}

/** Derive Firebase Storage path from a download URL (legacy submissions). */
function inferStoragePath(url) {
  if (!url) return "";
  try {
    const m = String(url).match(/\/o\/([^?]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  } catch {
    return "";
  }
}

function buildAdCard(ad) {
  const card = document.createElement("div");
  card.className = "admin-card feat-admin-card";

  const isSubmission = ad.source === "submission";
  const isText = ad.type === "text" || !ad.url;

  let thumb;
  if (ad.type === "video" && ad.url) {
    thumb = `<video src="${ad.url}" class="feat-card-thumb" muted preload="metadata"></video>`;
  } else if (ad.url) {
    thumb = `<img src="${ad.url}" alt="" class="feat-card-thumb" loading="lazy" decoding="async" />`;
  } else {
    thumb = `<div class="feat-card-thumb feat-card-thumb-text" aria-hidden="true">Aa</div>`;
  }

  const activeBadge = ad.active
    ? `<span class="badge badge-active">Active</span>`
    : `<span class="badge badge-inactive">Inactive</span>`;

  const sourceBadge = isSubmission
    ? `<span class="badge badge-submission">Promote Form</span>`
    : `<span class="badge badge-admin">Admin Upload</span>`;

  const typeBadge = ad.type === "video"
    ? `<span class="badge badge-video">Video</span>`
    : isText
      ? `<span class="badge badge-text-ad">Text</span>`
      : `<span class="badge badge-image">Image</span>`;

  card.innerHTML = `
    <div class="feat-card-left">${thumb}</div>
    <div class="feat-card-body">
      <div class="feat-card-meta">${activeBadge} ${sourceBadge} ${typeBadge} <span class="feat-order-tag">Order: ${ad.order ?? 0}</span></div>
      <h4 class="feat-card-title"></h4>
      <p class="feat-card-sub" hidden></p>
      <p class="feat-card-contact" hidden></p>
      <p class="feat-card-link-wrap" hidden><a class="feat-card-link-a" href="#" target="_blank" rel="noopener"></a></p>
    </div>
    <div class="feat-card-actions">
      <button class="ad-toggle-btn ${ad.active ? "btn-warning" : "btn-success"}" data-id="${ad.id}" data-active="${ad.active}">
        ${ad.active ? "Deactivate" : "Activate"}
      </button>
      <button class="ad-delete-btn btn-danger-sm" data-id="${ad.id}" data-path="">Delete</button>
    </div>`;

  card.querySelector(".feat-card-title").textContent = ad.title || ad.businessName || "Untitled";

  if (isSubmission && ad.businessName) {
    const sub = card.querySelector(".feat-card-sub");
    sub.hidden = false;
    sub.textContent = ad.businessName;
  }

  const contactParts = [ad.email, ad.phone].filter(Boolean);
  if (contactParts.length) {
    const contact = card.querySelector(".feat-card-contact");
    contact.hidden = false;
    contact.textContent = contactParts.join(" · ");
  }

  if (ad.link) {
    const wrap = card.querySelector(".feat-card-link-wrap");
    const a = card.querySelector(".feat-card-link-a");
    wrap.hidden = false;
    a.href = ad.link;
    a.textContent = ad.link;
  }

  const storagePath = ad.storagePath || inferStoragePath(ad.url);
  card.querySelector(".ad-delete-btn").dataset.path = storagePath || "";

  // Toggle active
  card.querySelector(".ad-toggle-btn").addEventListener("click", async (e) => {
    const btn      = e.currentTarget;
    const id       = btn.dataset.id;
    const wasActive = btn.dataset.active === "true";
    btn.disabled = true;
    try {
      await setAdActive(id, !wasActive);
    } catch (err) {
      showToast(toUserMessage(err), { kind: "error" });
    } finally {
      btn.disabled = false;
    }
  });

  // Delete
  card.querySelector(".ad-delete-btn").addEventListener("click", async (e) => {
    if (!confirm("Delete this ad permanently?")) return;
    const btn  = e.currentTarget;
    const id   = btn.dataset.id;
    const path = btn.dataset.path;
    btn.disabled = true;
    try {
      await deleteAd(id, path);
      showToast("Ad deleted.", { kind: "success" });
    } catch (err) {
      showToast(toUserMessage(err), { kind: "error" });
      btn.disabled = false;
    }
  });

  return card;
}


// ─────────────────────────────────────────────────────────────
//  MESSAGES PANEL
// ─────────────────────────────────────────────────────────────

let _allMsgs   = [];
let _unsubMsgs = null;

const REASON_LABELS = {
  "list-business":   "List My Business",
  "upgrade-listing": "Upgrade Listing",
  "general":         "General Inquiry",
  "report-issue":    "Report Issue",
  "advertise":       "Promote Business",
  "other":           "Other",
};

const STATUS_COLORS = {
  unread:  { bg: "#fff0f0", color: "var(--color-error)", label: "Unread" },
  read:    { bg: "#f0f9ff", color: "var(--color-info)", label: "Read"   },
  replied: { bg: "var(--color-primary-hover-bg)", color: "var(--color-primary)", label: "Replied"},
};

export function initMessagesPanel() {
  // Subscribe to contacts collection
  const q = query(collection(db, "contacts"), orderBy("createdAt", "desc"));
  _unsubMsgs = onSnapshot(q,
    (snap) => {
      _allMsgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderMessages();
      updateMsgBadge();
    },
    (err) => {
      reportError("admin.messages.stream", err);
      showToast(toUserMessage(err), { kind: "error", duration: 8000 });
    }
  );

  // Filters
  document.getElementById("msgStatusFilter")?.addEventListener("change", renderMessages);
  document.getElementById("msgReasonFilter")?.addEventListener("change", renderMessages);

  // Modal close on backdrop click
  document.getElementById("msgModal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeMsgModal();
  });

  window.addEventListener("pagehide", () => { if (_unsubMsgs) _unsubMsgs(); });
}

function updateMsgBadge() {
  const unread = _allMsgs.filter(m => m.status === "unread").length;
  const badge  = document.getElementById("msgBadge");
  if (!badge) return;
  if (unread > 0) {
    badge.textContent    = unread;
    badge.style.display  = "inline-block";
  } else {
    badge.style.display  = "none";
  }
}

function renderMessages() {
  const box          = document.getElementById("msgList");
  const statusFilter = document.getElementById("msgStatusFilter")?.value || "";
  const reasonFilter = document.getElementById("msgReasonFilter")?.value || "";
  const countEl      = document.getElementById("msgCount");
  if (!box) return;

  let filtered = _allMsgs;
  if (statusFilter) filtered = filtered.filter(m => m.status === statusFilter);
  if (reasonFilter) filtered = filtered.filter(m => m.reason === reasonFilter);

  if (countEl) countEl.textContent = `${filtered.length} message${filtered.length !== 1 ? "s" : ""}`;

  if (!filtered.length) {
    box.innerHTML = `<p class="empty-state">No messages found.</p>`;
    return;
  }

  box.innerHTML = "";
  filtered.forEach(msg => box.appendChild(buildMsgRow(msg)));
}

function buildMsgRow(msg) {
  const wrap = document.createElement("div");
  const sc   = STATUS_COLORS[msg.status] || STATUS_COLORS.unread;
  const ts   = msg.createdAt?.toDate
    ? msg.createdAt.toDate().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })
    : "—";
  const reason = REASON_LABELS[msg.reason] || msg.reason || "—";
  const preview = (msg.message || "").slice(0, 80) + ((msg.message || "").length > 80 ? "…" : "");

  wrap.innerHTML = `
    <div class="admin-card" style="
      display:flex; align-items:flex-start; gap:16px;
      padding:16px 18px; margin-bottom:10px;
      border-left:4px solid ${sc.color};
      cursor:pointer; transition:box-shadow .2s, transform .15s;
      ${msg.status === 'unread' ? 'background:#fffaf9;' : ''}
    " data-id="${msg.id}">
      <!-- Avatar -->
      <div style="width:42px;height:42px;border-radius:50%;background:${sc.bg};
                  display:flex;align-items:center;justify-content:center;
                  flex-shrink:0;font-size:16px;font-weight:700;color:${sc.color};">
        ${(msg.name || "?")[0].toUpperCase()}
      </div>
      <!-- Content -->
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
          <span style="font-size:14px;font-weight:${msg.status==='unread'?'700':'600'};color:var(--color-text-dark);">${msg.name || "Unknown"}</span>
          <span style="font-size:11px;font-weight:700;padding:2px 9px;border-radius:100px;background:${sc.bg};color:${sc.color};">${sc.label}</span>
          <span style="font-size:11px;padding:2px 9px;border-radius:100px;background:var(--color-surface-muted);color:var(--color-muted);">${reason}</span>
        </div>
        <div style="font-size:12px;color:var(--color-muted);margin-bottom:6px;">${msg.phone || ""}${msg.email ? " · " + msg.email : ""}</div>
        <div style="font-size:13px;color:var(--color-muted);line-height:1.5;">${preview}</div>
      </div>
      <!-- Time -->
      <div style="font-size:11px;color:#aaa;white-space:nowrap;flex-shrink:0;">${ts}</div>
    </div>`;

  wrap.querySelector("[data-id]").addEventListener("click", () => openMsgModal(msg));
  return wrap;
}

function openMsgModal(msg) {
  const modal   = document.getElementById("msgModal");
  const content = document.getElementById("msgModalContent");
  if (!modal || !content) return;

  const sc     = STATUS_COLORS[msg.status] || STATUS_COLORS.unread;
  const ts     = msg.createdAt?.toDate
    ? msg.createdAt.toDate().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })
    : "—";
  const reason = REASON_LABELS[msg.reason] || msg.reason || "—";

  content.innerHTML = `
    <!-- Modal header -->
    <div style="padding:20px 24px 16px;border-bottom:1px solid var(--color-navbar-border);display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:44px;height:44px;border-radius:50%;background:${sc.bg};display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:${sc.color};">
          ${(msg.name||"?")[0].toUpperCase()}
        </div>
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--color-text-dark);">${msg.name || "Unknown"}</div>
          <div style="font-size:12px;color:var(--color-muted);">${ts}</div>
        </div>
      </div>
      <button id="msgModalClose" style="width:34px;height:34px;border-radius:50%;border:1.5px solid var(--color-border);background:var(--color-surface-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--color-muted);">✕</button>
    </div>

    <!-- Meta info -->
    <div style="padding:16px 24px;display:grid;grid-template-columns:1fr 1fr;gap:12px;border-bottom:1px solid var(--color-navbar-border);">
      <div>
        <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--color-muted-light);margin-bottom:4px;">Phone</div>
        <div style="font-size:14px;font-weight:600;color:var(--color-text);">${msg.phone || "—"}</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--color-muted-light);margin-bottom:4px;">Email</div>
        <div style="font-size:14px;font-weight:600;color:var(--color-text);">${msg.email || "—"}</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--color-muted-light);margin-bottom:4px;">Reason</div>
        <div style="font-size:13px;font-weight:600;color:var(--color-text);">${reason}</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--color-muted-light);margin-bottom:4px;">Business</div>
        <div style="font-size:13px;font-weight:600;color:var(--color-text);">${msg.business || "—"}</div>
      </div>
    </div>

    <!-- Message body -->
    <div style="padding:20px 24px;border-bottom:1px solid var(--color-navbar-border);">
      <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--color-muted-light);margin-bottom:10px;">Message</div>
      <div style="font-size:14px;color:var(--color-text);line-height:1.75;white-space:pre-wrap;">${msg.message || ""}</div>
    </div>

    <!-- Actions -->
    <div style="padding:16px 24px;display:flex;gap:10px;flex-wrap:wrap;">
      ${msg.phone ? `<a href="tel:${msg.phone}" style="flex:1;min-width:120px;padding:10px;background:var(--color-primary-hover-bg);color:var(--color-primary);border-radius:10px;font-size:13px;font-weight:700;text-align:center;text-decoration:none;border:1.5px solid var(--color-primary-border-soft);">📞 Call</a>` : ""}
      ${msg.email ? `<a href="mailto:${msg.email}" style="flex:1;min-width:120px;padding:10px;background:#e8f4ff;color:var(--color-info);border-radius:10px;font-size:13px;font-weight:700;text-align:center;text-decoration:none;border:1.5px solid #b8d8ff;">✉️ Email</a>` : ""}
      ${msg.status !== "read"    ? `<button class="msg-action-btn" data-action="read"    data-id="${msg.id}" style="flex:1;min-width:120px;padding:10px;background:#f0f9ff;color:var(--color-info);border:1.5px solid #b8d8ff;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">Mark Read</button>` : ""}
      ${msg.status !== "replied" ? `<button class="msg-action-btn" data-action="replied" data-id="${msg.id}" style="flex:1;min-width:120px;padding:10px;background:var(--color-primary-hover-bg);color:var(--color-primary);border:1.5px solid var(--color-primary-border-soft);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">Mark Replied</button>` : ""}
      <button class="msg-action-btn" data-action="delete" data-id="${msg.id}" style="flex:1;min-width:120px;padding:10px;background:#fff0f0;color:var(--color-error);border:1.5px solid #ffc0c0;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">🗑 Delete</button>
    </div>`;

  modal.style.display = "flex";

  // Mark as read automatically on open
  if (msg.status === "unread") updateMsgStatus(msg.id, "read");

  document.getElementById("msgModalClose")?.addEventListener("click", closeMsgModal);

  content.querySelectorAll(".msg-action-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      const id     = btn.dataset.id;
      if (action === "delete") {
        if (!confirm("Delete this message?")) return;
        await deleteDoc(doc(db, "contacts", id)).catch(err => showToast(toUserMessage(err), { kind: "error" }));
        closeMsgModal();
      } else {
        await updateMsgStatus(id, action);
        closeMsgModal();
      }
    });
  });
}

function closeMsgModal() {
  const modal = document.getElementById("msgModal");
  if (modal) modal.style.display = "none";
}

async function updateMsgStatus(id, status) {
  try {
    await updateDoc(doc(db, "contacts", id), { status });
  } catch (err) {
    showToast(toUserMessage(err), { kind: "error" });
  }
}