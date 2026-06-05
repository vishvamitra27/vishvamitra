/**
 * Dynamic sitemap.xml for Vercel (static pages + active Firestore listings).
 * Served at /sitemap.xml via vercel.json rewrite.
 */

const SITE = "https://vishvamitra.com";
const PROJECT_ID = "vishvamitra-79627";
const API_KEY = process.env.FIREBASE_API_KEY || "AIzaSyD4pVmGDasFAADaiYctht55jE2NvIpHSto";

const STATIC_PAGES = [
  { loc: `${SITE}/`, changefreq: "daily", priority: "1.0" },
  { loc: `${SITE}/services.html`, changefreq: "daily", priority: "0.9" },
  { loc: `${SITE}/free-services.html`, changefreq: "weekly", priority: "0.85" },
  { loc: `${SITE}/paid-services.html`, changefreq: "weekly", priority: "0.85" },
  { loc: `${SITE}/contact.html`, changefreq: "monthly", priority: "0.7" },
  { loc: `${SITE}/advertise.html`, changefreq: "monthly", priority: "0.8" },
];

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

async function fetchActiveListingIds() {
  const urls = [];
  let pageToken = "";

  do {
    const params = new URLSearchParams({
      key: API_KEY,
      pageSize: "300",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/listings?${params}`
    );

    if (!res.ok) break;

    const data = await res.json();
    const docs = data.documents || [];

    for (const doc of docs) {
      const status = doc.fields?.status?.stringValue;
      if (status !== "active") continue;
      const id = doc.name.split("/").pop();
      urls.push({
        loc: `${SITE}/listing-details.html?id=${encodeURIComponent(id)}`,
        changefreq: "weekly",
        priority: "0.75",
        lastmod: doc.updateTime?.split("T")[0] || doc.createTime?.split("T")[0],
      });
    }

    pageToken = data.nextPageToken || "";
  } while (pageToken && urls.length < 5000);

  return urls;
}

async function handler(req, res) {
  const today = new Date().toISOString().split("T")[0];
  const staticEntries = STATIC_PAGES.map((p) =>
    urlEntry({ ...p, lastmod: today })
  );

  let listingEntries = [];
  try {
    const listings = await fetchActiveListingIds();
    listingEntries = listings.map((p) => urlEntry(p));
  } catch (err) {
    console.error("[sitemap]", err);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticEntries.join("\n")}
${listingEntries.join("\n")}
</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(xml);
}

export default handler;
module.exports = handler;
