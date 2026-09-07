/**
 * Global performance & accessibility bootstrap (no UI redesign).
 * Imported from navbar.js and standalone pages without navbar.
 */
import "./seo-init.js";

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");

function injectSkipLink() {
  if (document.getElementById("skip-to-main")) return;

  const main =
    document.getElementById("main-content") ||
    document.querySelector("main") ||
    document.querySelector('[role="main"]');

  const targetId = main?.id || (main ? ensureMainId(main) : null);
  if (!targetId) return;

  const link = document.createElement("a");
  link.id = "skip-to-main";
  link.className = "skip-link";
  link.href = `#${targetId}`;
  link.textContent = "Skip to main content";
  document.body.prepend(link);
}

function ensureMainId(el) {
  if (!el.id) el.id = "main-content";
  return el.id;
}

/** Lazy-load images injected without loading= (dynamic listings, admin) */
function initLazyImages() {
  const enhance = () => {
    document.querySelectorAll("img:not([loading])").forEach((img) => {
      if (img.closest(".home-hero, .feat-carousel .feat-slide.active, .sv-ad-section .feat-slide.active")) return;
      if (img.getAttribute("fetchpriority") === "high") return;
      img.loading = "lazy";
      if (!img.hasAttribute("decoding")) img.decoding = "async";
    });
  };

  enhance();
  new MutationObserver(enhance).observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/** Pause off-screen carousel videos (save bandwidth + main thread) */
function initCarouselVideoObserver() {
  if (!("IntersectionObserver" in window)) return;
  const carousel = document.getElementById("featCarousel");
  if (!carousel) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        carousel.querySelectorAll("video").forEach((v) => {
          if (entry.isIntersecting && v.closest(".feat-slide.active")) {
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        });
      });
    },
    { threshold: 0.25 }
  );
  io.observe(carousel);
}

function markExternalLinks() {
  document.querySelectorAll('a[target="_blank"]').forEach((a) => {
    if (!a.rel.includes("noopener")) {
      a.rel = (a.rel ? a.rel + " " : "") + "noopener noreferrer";
    }
    if (!a.getAttribute("aria-label") && !a.textContent.trim()) {
      a.setAttribute("aria-label", "Opens in a new tab");
    }
  });
}

function init() {
  injectSkipLink();
  initLazyImages();
  initCarouselVideoObserver();
  markExternalLinks();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectSkipLink, { once: true });
  }
}

init();
