/**
 * One-time / CI helper: replace legacy Vercel URLs with vishvamitra.com in pages/*.html
 * Run: node scripts/patch-seo-domain.js
 */
const fs = require("fs");
const path = require("path");

const pagesDir = path.join(__dirname, "..", "pages");
const FROM = "https://vishvamitra.vercel.app";
const TO = "https://vishvamitra.com";

for (const file of fs.readdirSync(pagesDir)) {
  if (!file.endsWith(".html")) continue;
  const fp = path.join(pagesDir, file);
  const html = fs.readFileSync(fp, "utf8");
  if (!html.includes(FROM)) continue;
  fs.writeFileSync(fp, html.split(FROM).join(TO));
  console.log("Updated", file);
}

console.log("Done.");
