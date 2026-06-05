/**
 * Google Analytics 4 — loads only on production host with a valid Measurement ID.
 */
import { SEO } from "./seo-config.js";

const GA_ID = SEO.ga4MeasurementId;
const PLACEHOLDER = /^G-XXXXXXXXXX$/i;

function isProductionHost() {
  const host = location.hostname;
  return host === "vishvamitra.com" || host === "www.vishvamitra.com";
}

export function initGoogleAnalytics() {
  if (!GA_ID || PLACEHOLDER.test(GA_ID)) return;
  if (!isProductionHost()) return;
  if (window.__vmGa4Loaded) return;
  window.__vmGa4Loaded = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, {
    anonymize_ip: true,
    send_page_view: true,
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(script);
}
