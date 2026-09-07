/**
 * Central SEO configuration for Vishvamitra (production: vishvamitra.com)
 */

export const SEO = {
  siteOrigin: "https://vishvamitra.com",
  siteName: "Vishvamitra",
  defaultImagePath: "/assets/images/banner.svg",
  locale: "en_IN",
  language: "en",
  twitterSite: "@vishvamitra_services",
  areaServed: "Andhra Pradesh, India",
  /** Replace with your GA4 Measurement ID from Google Analytics (e.g. G-ABC123XYZ) */
  ga4MeasurementId: "G-GP21V1BHFS",
  /** Optional: Google Search Console HTML tag verification content value */
  googleSiteVerification: "tYZscaWFtz8n6tgfUIdeK01Wn5_EanWZk-FPJcPhTLI",
  organization: {
    legalName: "Vishvamitra",
    email: "vishvamitra27@gmail.com",
    sameAs: [
      "https://www.facebook.com/profile.php?id=61585787019425",
      "https://www.instagram.com/vishvamitra_services/",
    ],
  },
};

/** Indexable static pages (public URLs after Vercel rewrites) */
export const INDEXABLE_PAGES = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/services.html", priority: "0.9", changefreq: "daily" },
  { path: "/free-services.html", priority: "0.85", changefreq: "weekly" },
  { path: "/paid-services.html", priority: "0.85", changefreq: "weekly" },
  { path: "/contact.html", priority: "0.7", changefreq: "monthly" },
  { path: "/advertise.html", priority: "0.8", changefreq: "monthly" },
];

/** Paths that must not be indexed */
export const NOINDEX_PAGES = [
  "login.html",
  "signup.html",
  "dashboard.html",
  "user-dashboard.html",
  "admin.html",
  "add-listing.html",
  "role-select.html",
  "vendor-setup.html",
];

export function canonicalUrl(pagePath) {
  const base = SEO.siteOrigin.replace(/\/$/, "");
  if (!pagePath || pagePath === "/" || pagePath === "index.html") {
    return `${base}/`;
  }
  const path = pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
  return `${base}${path}`;
}

export function absoluteAssetUrl(assetPath) {
  const base = SEO.siteOrigin.replace(/\/$/, "");
  const path = assetPath.startsWith("/") ? assetPath : `/${assetPath}`;
  return `${base}${path}`;
}

export function defaultOgImage() {
  return absoluteAssetUrl(SEO.defaultImagePath);
}

export function applyPageMeta({
  title,
  description,
  url,
  image,
  type = "website",
  robots = null,
}) {
  if (title) document.title = title;

  const setMeta = (selector, attr, attrName, value) => {
    if (!value) return;
    let el = document.querySelector(selector);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attrName, attr);
      document.head.appendChild(el);
    }
    el.setAttribute("content", value);
  };

  setMeta('meta[name="description"]', "description", "name", description);
  setMeta('meta[property="og:title"]', "og:title", "property", title);
  setMeta('meta[property="og:description"]', "og:description", "property", description);
  setMeta('meta[property="og:url"]', "og:url", "property", url);
  setMeta('meta[property="og:type"]', "og:type", "property", type);
  setMeta('meta[property="og:image"]', "og:image", "property", image);
  setMeta('meta[property="og:site_name"]', "og:site_name", "property", SEO.siteName);
  setMeta('meta[property="og:locale"]', "og:locale", "property", SEO.locale.replace("_", "-"));
  setMeta('meta[name="twitter:card"]', "twitter:card", "name", "summary_large_image");
  setMeta('meta[name="twitter:site"]', "twitter:site", "name", SEO.twitterSite);
  setMeta('meta[name="twitter:title"]', "twitter:title", "name", title);
  setMeta('meta[name="twitter:description"]', "twitter:description", "name", description);
  setMeta('meta[name="twitter:image"]', "twitter:image", "name", image);

  if (robots) {
    setMeta('meta[name="robots"]', "robots", "name", robots);
  }

  if (url) {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = url;
  }
}

export function injectJsonLd(data, id = "json-ld-dynamic") {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function buildOrganizationJsonLd() {
  const origin = SEO.siteOrigin.replace(/\/$/, "");
  return {
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: SEO.organization.legalName,
    url: `${origin}/`,
    logo: absoluteAssetUrl(SEO.defaultImagePath),
    email: SEO.organization.email,
    areaServed: SEO.areaServed,
    sameAs: SEO.organization.sameAs,
  };
}

export function buildWebsiteJsonLd() {
  const origin = SEO.siteOrigin.replace(/\/$/, "");
  return {
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    name: SEO.siteName,
    url: `${origin}/`,
    publisher: { "@id": `${origin}/#organization` },
    inLanguage: "en-IN",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${origin}/services.html?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildSiteGraphJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [buildOrganizationJsonLd(), buildWebsiteJsonLd()],
  };
}

export function buildListingJsonLd(listing, pageUrl) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: listing.name || "Business",
    url: pageUrl,
  };
  if (listing.description) schema.description = listing.description;
  if (listing.phone) schema.telephone = listing.phone;
  if (listing.location) {
    schema.address = {
      "@type": "PostalAddress",
      streetAddress: listing.location,
      addressRegion: "Andhra Pradesh",
      addressCountry: "IN",
    };
  }
  if (listing.image) schema.image = listing.image;
  if (listing.category) schema.category = (listing.category || "").replace(/-/g, " ");
  return schema;
}
