/**
 * scripts/ad-carousel.js
 * Shared homepage / services ad carousel — admin + advertise.html submissions.
 */

import { subscribeToActiveAds } from "./ads.js";

const DEFAULT_INTERVAL_MS = 4000;

const PHONE_ICON = `<svg class="feat-text-card-chip-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;

// Max service chips shown per card — keeps very long comma lists from
// overflowing the fixed-height carousel box. Not text truncation of any
// single service name, just a cap on how many chips are listed.
const MAX_SERVICE_CHIPS = 8;

const _preloaded = new Set();

function preloadImage(url) {
  if (!url || _preloaded.has(url)) return;
  _preloaded.add(url);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
}

function preloadAround(ads, index) {
  if (!ads.length) return;
  const next = (index + 1) % ads.length;
  const ahead = (index + 2) % ads.length;
  [index, next, ahead].forEach((i) => {
    const ad = ads[i];
    if (ad?.url && ad.type !== "video") preloadImage(ad.url);
  });
}

/**
 * Business-spotlight text card: business name is the single dominant
 * element at every breakpoint (desktop + mobile), with services and
 * phone underneath. Long names/service lists get a smaller type-scale
 * (via .is-* modifier classes below) instead of being clipped.
 */
function buildTextCard(ad) {
  const card = document.createElement("div");
  card.className = "feat-text-card";
  card.innerHTML = `
    <div class="feat-text-card-mobile">
      <div class="feat-text-card-mobile-biz"></div>
      <div class="feat-text-card-mobile-services" hidden></div>
      <div class="feat-text-card-mobile-phone" hidden></div>
    </div>`;

  const businessName = String(ad.businessName || ad.title || "Business Spotlight").trim();
  const bizEl = card.querySelector(".feat-text-card-mobile-biz");
  bizEl.textContent = businessName;
  // Dynamic type-scale for long names — wraps gracefully instead of clipping.
  if (businessName.length > 42) bizEl.classList.add("is-name-lg-overflow");
  else if (businessName.length > 26) bizEl.classList.add("is-name-long");

  const servicesEl = card.querySelector(".feat-text-card-mobile-services");
  if (ad.description) {
    const lines = String(ad.description)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length) {
      servicesEl.hidden = false;
      const shown = lines.slice(0, MAX_SERVICE_CHIPS);
      const extra = lines.length - shown.length;
      shown.forEach((service) => {
        const line = document.createElement("div");
        line.className = "feat-text-card-mobile-service-line";
        line.textContent = service;
        servicesEl.appendChild(line);
      });
      if (extra > 0) {
        const more = document.createElement("div");
        more.className = "feat-text-card-mobile-service-line feat-text-card-mobile-service-more";
        more.textContent = `+${extra} more`;
        servicesEl.appendChild(more);
      }
      if (shown.some((s) => s.length > 24)) servicesEl.classList.add("is-services-long");
    }
  }

  const phone = String(ad.phone || "").trim();
  const mobilePhone = card.querySelector(".feat-text-card-mobile-phone");
  if (phone) {
    mobilePhone.hidden = false;
    mobilePhone.insertAdjacentHTML("afterbegin", PHONE_ICON);
    const label = document.createElement("span");
    label.textContent = phone;
    mobilePhone.appendChild(label);
  }

  return card;
}

function buildMediaSlide(ad, i) {
  const slide = document.createElement("div");
  slide.className = "feat-slide" + (i === 0 ? " active" : "");

  const frame = document.createElement("div");
  frame.className = "feat-media-frame";

  let media;

  if (ad.type === "video") {
    media = document.createElement("video");
    media.src = ad.url;
    media.loop = true;
    media.muted = true;
    media.playsInline = true;
    media.className = "feat-media";
    media.preload = i === 0 ? "metadata" : "none";
    if (i === 0) media.autoplay = true;
    media.addEventListener("loadedmetadata", () => {
      applyAspectClass(frame, media.videoWidth, media.videoHeight);
    });
  } else {
    media = document.createElement("img");
    media.src = ad.url;
    media.alt = ad.title || "Business Spotlight";
    media.loading = i === 0 ? "eager" : "lazy";
    media.decoding = "async";
    if (i === 0) media.fetchPriority = "high";
    media.className = "feat-media";
    if (media.complete && media.naturalWidth) {
      applyAspectClass(frame, media.naturalWidth, media.naturalHeight);
    } else {
      media.addEventListener("load", () => {
        applyAspectClass(frame, media.naturalWidth, media.naturalHeight);
      });
    }
    if (i <= 1) preloadImage(ad.url);
  }

  frame.appendChild(media);

  if (ad.link) {
    const a = document.createElement("a");
    a.href = ad.link;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.cssText = "display:flex;width:100%;height:100%;align-items:center;justify-content:center;position:relative;z-index:1;";
    a.appendChild(frame);
    slide.appendChild(a);
  } else {
    slide.appendChild(frame);
  }

  return slide;
}

/**
 * Tags the media frame as portrait/landscape once real dimensions are
 * known, so CSS can give tall images a premium matted-card treatment
 * (Tasks 3 & 4) instead of leaving them stretched across the wide
 * landscape carousel slot. Never stretches, crops, or blurs the image
 * itself — purely a framing decision.
 */
function applyAspectClass(frame, w, h) {
  if (!w || !h) return;
  const ratio = w / h;
  frame.style.aspectRatio = `${w} / ${h}`;
  frame.classList.remove("is-portrait", "is-landscape");
  frame.classList.add(ratio <= 0.92 ? "is-portrait" : "is-landscape");
}

/**
 * @param {Object} [options]
 * @param {Object} [options.ids] - DOM id map
 * @param {number} [options.intervalMs] - auto-advance interval (default 10s)
 * @param {HTMLElement} [options.sectionEl] - outer section to show/hide
 * @param {() => boolean} [options.isVisible] - when false, carousel is hidden
 */
export function createAdCarousel(options = {}) {
  const ids = {
    fallback: "adFallbackImg",
    carousel: "featCarousel",
    track: "featCarouselTrack",
    dots: "featCarouselDots",
    prev: "featPrev",
    next: "featNext",
    ...options.ids,
  };

  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const sectionEl = options.sectionEl ?? null;
  const isVisible = options.isVisible ?? (() => true);

  const fallback = document.getElementById(ids.fallback);
  const carousel = document.getElementById(ids.carousel);
  const track = document.getElementById(ids.track);
  const dots = document.getElementById(ids.dots);
  const prev = document.getElementById(ids.prev);
  const next = document.getElementById(ids.next);

  if (!track || !carousel) return { destroy() {} };

  let unsub = null;
  let timer = null;
  let index = 0;
  let ads = [];
  let allAds = [];       // last raw snapshot, pre-category-filter
  let category = options.category ?? "";
  let paused = false;

  function setSectionVisible(show) {
    if (sectionEl) sectionEl.hidden = !show;
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function goToSlide(idx) {
    const slides = track.querySelectorAll(".feat-slide");
    const ddots = dots?.querySelectorAll(".feat-dot") ?? [];
    if (!slides.length) return;

    slides[index]?.classList.remove("active");
    ddots[index]?.classList.remove("active");

    index = (idx + slides.length) % slides.length;

    slides[index]?.classList.add("active");
    ddots[index]?.classList.add("active");

    slides.forEach((slide, si) => {
      slide.querySelectorAll("video").forEach((v) => {
        if (si === index) v.play().catch(() => {});
        else v.pause();
      });
    });

    preloadAround(ads, index);
  }

  function startTimer() {
    if (paused || ads.length <= 1) return;
    stopTimer();
    timer = setInterval(() => goToSlide(index + 1), intervalMs);
  }

  function buildCarousel(adList) {
    stopTimer();
    index = 0;
    track.innerHTML = "";
    if (dots) dots.innerHTML = "";

    adList.forEach((ad, i) => {
      const slide =
        ad.type === "text" || !ad.url
          ? (() => {
              const el = document.createElement("div");
              el.className = "feat-slide" + (i === 0 ? " active" : "");
              el.appendChild(buildTextCard(ad));
              return el;
            })()
          : buildMediaSlide(ad, i);

      track.appendChild(slide);

      if (dots) {
        const dot = document.createElement("button");
        dot.className = "feat-dot" + (i === 0 ? " active" : "");
        dot.setAttribute("aria-label", "Go to ad " + (i + 1));
        dot.addEventListener("click", () => {
          stopTimer();
          goToSlide(i);
          startTimer();
        });
        dots.appendChild(dot);
      }
    });

    const multi = adList.length > 1;
    if (prev) prev.style.display = multi ? "" : "none";
    if (next) next.style.display = multi ? "" : "none";

    preloadAround(adList, 0);
    startTimer();
  }

  function render(adList) {
    allAds = adList;
    // "All Categories" (empty string) shows every ad — same convention as listings.
    ads = category ? adList.filter((ad) => (ad.category || "") === category) : adList;

    if (!isVisible()) {
      setSectionVisible(false);
      stopTimer();
      return;
    }

    if (!ads.length) {
      if (fallback) fallback.style.display = "";
      carousel.style.display = "none";
      setSectionVisible(options.hideWhenEmpty ?? false);
      return;
    }

    if (fallback) fallback.style.display = "none";
    carousel.style.display = "";
    setSectionVisible(true);
    buildCarousel(ads);
  }

  unsub = subscribeToActiveAds(
    render,
    (err) => console.warn("[feat-carousel]", err)
  );

  carousel.addEventListener("mouseenter", () => {
    paused = true;
    stopTimer();
  });
  carousel.addEventListener("mouseleave", () => {
    paused = false;
    startTimer();
  });

  prev?.addEventListener("click", () => {
    stopTimer();
    goToSlide(index - 1);
    startTimer();
  });
  next?.addEventListener("click", () => {
    stopTimer();
    goToSlide(index + 1);
    startTimer();
  });

  const onPageHide = () => {
    if (unsub) unsub();
    stopTimer();
  };
  window.addEventListener("pagehide", onPageHide);

  return {
    refresh() {
      render(allAds);
    },
    /** Optional: filter the carousel to one category ("" = all). Re-renders instantly. */
    setCategory(cat) {
      category = cat || "";
      render(allAds);
    },
    destroy() {
      if (unsub) unsub();
      unsub = null;
      stopTimer();
      window.removeEventListener("pagehide", onPageHide);
    },
  };
}