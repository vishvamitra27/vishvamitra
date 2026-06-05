/**
 * scripts/ad-carousel.js
 * Shared homepage / services ad carousel — admin + advertise.html submissions.
 */

import { subscribeToActiveAds } from "./ads.js";

const DEFAULT_INTERVAL_MS = 10000;

const EMAIL_ICON = `<svg class="ad-text-card-chip-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></svg>`;
const PHONE_ICON = `<svg class="ad-text-card-chip-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;

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

function buildTextCard(ad) {
  const card = document.createElement("div");
  card.className = "ad-text-card";
  card.innerHTML = `
    ${ad.businessName ? `<div class="ad-text-card-biz"></div>` : ""}
    <div class="ad-text-card-title"></div>
    ${ad.description ? `<div class="ad-text-card-desc"></div>` : ""}
    <div class="ad-text-card-contact" hidden>
      <div class="ad-text-card-divider" aria-hidden="true"></div>
      <div class="ad-text-card-chips"></div>
    </div>`;

  if (ad.businessName) card.querySelector(".ad-text-card-biz").textContent = ad.businessName;
  card.querySelector(".ad-text-card-title").textContent = ad.title || "Advertisement";
  if (ad.description) card.querySelector(".ad-text-card-desc").textContent = ad.description;

  const email = String(ad.email || "").trim();
  const phone = String(ad.phone || "").trim();
  if (email || phone) {
    const contactRow = card.querySelector(".ad-text-card-contact");
    const chipsEl = card.querySelector(".ad-text-card-chips");
    contactRow.hidden = false;

    if (email) {
      const chip = document.createElement("span");
      chip.className = "ad-text-card-chip";
      chip.insertAdjacentHTML("afterbegin", EMAIL_ICON);
      const label = document.createElement("span");
      label.textContent = email;
      chip.appendChild(label);
      chipsEl.appendChild(chip);
    }
    if (phone) {
      const chip = document.createElement("span");
      chip.className = "ad-text-card-chip";
      chip.insertAdjacentHTML("afterbegin", PHONE_ICON);
      const label = document.createElement("span");
      label.textContent = phone;
      chip.appendChild(label);
      chipsEl.appendChild(chip);
    }
  }

  return card;
}

function buildMediaSlide(ad, i) {
  const slide = document.createElement("div");
  slide.className = "ad-slide" + (i === 0 ? " active" : "");

  let media;
  const bg = document.createElement("div");
  bg.className = "ad-slide-bg";

  if (ad.type === "video") {
    media = document.createElement("video");
    media.src = ad.url;
    media.loop = true;
    media.muted = true;
    media.playsInline = true;
    media.className = "ad-media";
    media.preload = i === 0 ? "metadata" : "none";
    if (i === 0) media.autoplay = true;

    const bgVid = document.createElement("video");
    bgVid.src = ad.url;
    bgVid.loop = true;
    bgVid.muted = true;
    bgVid.playsInline = true;
    bgVid.preload = "none";
    bgVid.autoplay = i === 0;
    bgVid.style.cssText =
      "position:absolute;inset:-10px;width:calc(100%+20px);height:calc(100%+20px);object-fit:cover;filter:blur(18px) brightness(0.4);transform:scale(1.05);";
    slide.appendChild(bgVid);
  } else {
    media = document.createElement("img");
    media.src = ad.url;
    media.alt = ad.title || "Advertisement";
    media.loading = i === 0 ? "eager" : "lazy";
    media.decoding = "async";
    if (i === 0) media.fetchPriority = "high";
    media.className = "ad-media";
    bg.style.backgroundImage = `url('${ad.url}')`;
    slide.appendChild(bg);
    if (i <= 1) preloadImage(ad.url);
  }

  if (ad.link) {
    const a = document.createElement("a");
    a.href = ad.link;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.cssText = "display:block;height:100%;position:relative;z-index:1;";
    a.appendChild(media);
    slide.appendChild(a);
  } else {
    slide.appendChild(media);
  }

  return slide;
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
    carousel: "adCarousel",
    track: "adCarouselTrack",
    dots: "adCarouselDots",
    prev: "adPrev",
    next: "adNext",
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
    const slides = track.querySelectorAll(".ad-slide");
    const ddots = dots?.querySelectorAll(".ad-dot") ?? [];
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
              el.className = "ad-slide" + (i === 0 ? " active" : "");
              el.appendChild(buildTextCard(ad));
              return el;
            })()
          : buildMediaSlide(ad, i);

      track.appendChild(slide);

      if (dots) {
        const dot = document.createElement("button");
        dot.className = "ad-dot" + (i === 0 ? " active" : "");
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
    ads = adList;

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
    (err) => console.warn("[ad-carousel]", err)
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
      render(ads);
    },
    destroy() {
      if (unsub) unsub();
      unsub = null;
      stopTimer();
      window.removeEventListener("pagehide", onPageHide);
    },
  };
}
