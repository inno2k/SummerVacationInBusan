const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const docsRoot = path.resolve(__dirname, "../..");
const html = fs.readFileSync(path.join(docsRoot, "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");

function relativeLuminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map((channel) => Number.parseInt(channel, 16) / 255);
  const [red, green, blue] = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground, background) {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

assert.match(html, /Noto(?:\+| )Serif(?:\+| )KR/);
assert.match(html, /Noto(?:\+| )Sans(?:\+| )KR/);
assert.match(css, /--seafoam:/);
assert.match(css, /--peach:/);
assert.match(css, /body::before/);
assert.match(css, /@media\(max-width:760px\)/);
assert.match(css, /--action-bg:#f6b8ad/);
assert.match(css, /--action-hover:var\(--peach\)/);
assert.match(css, /--action-foreground:#123041/);
assert.match(css, /\.primary\{background:var\(--action-bg\);[^}]*color:var\(--action-foreground\)/);
assert.match(css, /\.map-day-filter button\.active,[^}]*\{background:var\(--action-bg\);[^}]*color:var\(--action-foreground\)/);
assert.match(css, /@media\(max-width:760px\)\{body::before\{min-height:28rem;opacity:\.72\}/);
assert.ok(contrastRatio("#123041", "#f6b8ad") >= 4.5);
assert.ok(contrastRatio("#123041", "#ef8e7d") >= 4.5);
process.stdout.write("coastal style contract passed\n");
