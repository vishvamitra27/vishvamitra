/**
 * Global SEO bootstrap: GA4, canonical host alignment, GSC verification meta.
 */
import { SEO } from "./seo-config.js";
import { initGoogleAnalytics } from "./analytics.js";

const PRODUCTION_HOSTS = new Set(["vishvamitra.com", "www.vishvamitra.com"]);
const LEGACY_HOSTS = new Set(["vishvamitra.vercel.app"]);

function ensureResourceHint(rel, href, crossOrigin = false) {
  if (document.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = rel;
  link.href = href;
  if (crossOrigin) link.crossOrigin = "";
  document.head.appendChild(link);
}

function fixCanonicalHost() {
  const host = location.hostname;
  if (!PRODUCTION_HOSTS.has(host) && !LEGACY_HOSTS.has(host)) return;

  const canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical?.href) return;

  try {
    const url = new URL(canonical.href);
    if (url.hostname === "vishvamitra.vercel.app" || host === "www.vishvamitra.com") {
      url.hostname = "vishvamitra.com";
      url.protocol = "https:";
      canonical.href = url.toString();
    }
  } catch {
    /* ignore malformed canonical */
  }

  document.querySelectorAll('meta[property="og:url"], meta[property="og:image"]').forEach((el) => {
    if (!el.content) return;
    el.content = el.content.replace(
      "https://vishvamitra.vercel.app",
      SEO.siteOrigin.replace(/\/$/, "")
    );
  });
}

function injectSiteVerification() {
  if (!SEO.googleSiteVerification) return;
  let el = document.querySelector('meta[name="google-site-verification"]');
  if (!el) {
    el = document.createElement("meta");
    el.name = "google-site-verification";
    document.head.appendChild(el);
  }
  el.content = SEO.googleSiteVerification;
}

export function initSeo() {
  ensureResourceHint("dns-prefetch", "https://www.googletagmanager.com");
  ensureResourceHint("preconnect", "https://www.googletagmanager.com");
  fixCanonicalHost();
  injectSiteVerification();
  initGoogleAnalytics();
}

initSeo();
