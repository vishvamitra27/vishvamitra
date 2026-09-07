# Vishvamitra SEO — Production Guide

Production domain: **https://vishvamitra.com**

## File locations

| Asset | Path | URL |
|--------|------|-----|
| Robots | `public/robots.txt` | https://vishvamitra.com/robots.txt |
| Dynamic sitemap | `api/sitemap.js` | https://vishvamitra.com/sitemap.xml |
| SEO config | `scripts/seo-config.js` | — |
| GA4 loader | `scripts/analytics.js` | — |
| Global SEO init | `scripts/seo-init.js` | (imported via `scripts/performance.js` → `navbar.js`) |
| Vercel routing | `vercel.json` | Rewrites `/sitemap.xml` → API |
| Page meta | `pages/*.html` | Per-page `<title>`, canonical, OG, Twitter |
| Domain patch script | `scripts/patch-seo-domain.js` | `node scripts/patch-seo-domain.js` |

## Before deploy (required)

1. **Google Analytics 4**  
   In `scripts/seo-config.js`, set:
   ```js
   ga4MeasurementId: "G-YOUR_MEASUREMENT_ID",
   ```

2. **Google Search Console**  
   - Add property `https://vishvamitra.com`  
   - Verify via HTML tag; paste the `content` value into:
     ```js
     googleSiteVerification: "your-verification-code",
     ```
   - Submit sitemap: `https://vishvamitra.com/sitemap.xml`

3. **Vercel domain**  
   Point `vishvamitra.com` (and optionally `www`) to the Vercel project.  
   Redirect `www` → apex in Vercel DNS settings.

4. **Optional env** (Vercel → Settings → Environment Variables):
   - `FIREBASE_API_KEY` — used by `api/sitemap.js` to list active listings (falls back to client key in repo).

## Indexing rules

| Page | robots |
|------|--------|
| `/`, services, free/paid services, contact, advertise | `index, follow` |
| `listing-details.html?id=…` (active listing) | `index, follow` (set in JS) |
| `listing-details.html` (no id / invalid) | `noindex` |
| login, signup, dashboards, admin, vendor flows | `noindex, nofollow` |

## Structured data

- **Home** (`pages/index.html`): JSON-LD `@graph` with `Organization` + `WebSite` + `SearchAction`
- **Listing detail**: `LocalBusiness` injected when listing loads (`scripts/seo-config.js`)
- **Collection pages**: `CollectionPage` on services / free / paid / contact / advertise

## Core Web Vitals (already in codebase)

- `styles/fonts.css` — single font request, `display=swap`
- `styles/performance.css` — `content-visibility`, reduced motion
- `scripts/performance.js` — lazy images, preconnect hints
- Non-blocking AOS on home page

Run Lighthouse on production after deploy (Mobile + Desktop).

## Regenerate static URLs after domain change

```bash
node scripts/patch-seo-domain.js
```

## Sitemap contents

`api/sitemap.js` emits:

- All public static pages
- Every **active** Firestore listing as `/listing-details.html?id={id}`

Cached 1 hour at the edge (`s-maxage=3600`).
