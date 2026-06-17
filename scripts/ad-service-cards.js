/**
 * Render active ads as services-grid cards (same layout as listings).
 */

import { subscribeToActiveAds } from "./ads.js";

const _preloaded = new Set();

function preloadImage(url) {
  if (!url || _preloaded.has(url)) return;
  _preloaded.add(url);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
}

/** Client-side keyword filter for ad cards */
export function filterAds(ads, keyword) {
  if (!keyword) return ads;
  const kw = keyword.toLowerCase();
  return ads.filter((ad) =>
    `${ad.title} ${ad.businessName} ${ad.description} ${ad.email} ${ad.phone} ${ad.fullName}`
      .toLowerCase()
      .includes(kw)
  );
}

function adMediaHtml(ad, eager) {
  if (ad.url && ad.type === "video") {
    return `<video class="sv-card-img" src="${ad.url}" muted playsinline preload="metadata" aria-hidden="true"></video>`;
  }
  if (ad.url) {
    const load = eager ? "eager" : "lazy";
    const prio = eager ? ' fetchpriority="high"' : "";
    if (eager) preloadImage(ad.url);
    return `<img class="sv-card-img" src="${ad.url}" alt="" loading="${load}" decoding="async"${prio}/>`;
  }
  return `<div class="sv-card-no-img sv-card-feat-promo" aria-hidden="true">
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
      <path d="M3 11l19-9-9 19-2-8-8-2z"/>
    </svg>
    <span>Business</span>
  </div>`;
}

function appendContactChips(container, ad) {
  const phone = String(ad.phone || "").trim();
  const email = String(ad.email || "").trim();

  if (!phone && !email) {
    container.hidden = true;
    return;
  }

  const phoneIcon = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
  const emailIcon = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></svg>`;

  if (phone) {
    const chip = document.createElement("span");
    chip.className = "sv-card-feat-chip";
    chip.insertAdjacentHTML("afterbegin", phoneIcon);
    const label = document.createElement("span");
    label.textContent = phone;
    chip.appendChild(label);
    container.appendChild(chip);
  }
  if (email) {
    const chip = document.createElement("span");
    chip.className = "sv-card-feat-chip";
    chip.insertAdjacentHTML("afterbegin", emailIcon);
    const label = document.createElement("span");
    label.textContent = email;
    chip.appendChild(label);
    container.appendChild(chip);
  }
}

function adActionLabel(ad) {
  if (ad.link) return "Visit →";
  if (ad.phone) return "Call →";
  if (ad.email) return "Email →";
  return "Featured";
}

function resolveAdHref(ad) {
  const link = String(ad.link || "").trim();
  if (link) return { href: link, external: true };
  const phone = String(ad.phone || "").trim();
  if (phone) return { href: `tel:${phone}` };
  const email = String(ad.email || "").trim();
  if (email) return { href: `mailto:${email}` };
  return null;
}

/**
 * Build one ad card matching .sv-card listing layout.
 * @param {Object} ad
 * @param {number} index - position in grid (first images eager-loaded)
 */
export function buildServiceAdCard(ad, index = 0) {
  const target = resolveAdHref(ad);
  const el = document.createElement(target ? "a" : "div");
  el.className = "sv-card sv-card-feat";
  el.dataset.adId = ad.id || "";

  if (target) {
    el.href = target.href;
    if (target.external) {
      el.target = "_blank";
      el.rel = "noopener noreferrer";
    }
  }

  const eager = index < 4;
  const businessName = String(ad.businessName || "").trim();
  const title = String(ad.title || "").trim();
  const description = String(ad.description || "").trim();
  const displayName = businessName || title || "Business";
  const subtitle =
    businessName && title && businessName.toLowerCase() !== title.toLowerCase()
      ? title
      : description;

  el.innerHTML = `
    <div class="sv-card-img-wrap">
      ${adMediaHtml(ad, eager)}
      <span class="sv-card-badge sv-feat-badge">Featured</span>
    </div>
    <div class="sv-card-body">
      <div class="sv-card-name"></div>
      <div class="sv-card-desc"></div>
      <div class="sv-card-feat-contact"></div>
      <div class="sv-card-footer">
        <span class="sv-card-cat sv-card-cat-feat">featured</span>
        <span class="sv-card-arrow"></span>
      </div>
    </div>`;

  el.querySelector(".sv-card-name").textContent = displayName;

  const descEl = el.querySelector(".sv-card-desc");
  if (subtitle && subtitle.toLowerCase() !== displayName.toLowerCase()) {
    descEl.textContent = subtitle;
  } else {
    descEl.hidden = true;
  }

  appendContactChips(el.querySelector(".sv-card-feat-contact"), ad);
  el.querySelector(".sv-card-arrow").textContent = adActionLabel(ad);

  const img = el.querySelector("img.sv-card-img");
  if (img && displayName) img.alt = displayName;

  return el;
}

/** Subscribe to active ads for the services grid */
export function watchServiceAds(callback, onError) {
  return subscribeToActiveAds(callback, onError);
}
