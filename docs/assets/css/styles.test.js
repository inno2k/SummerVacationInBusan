const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const docsRoot = path.resolve(__dirname, "../..");
const html = fs.readFileSync(path.join(docsRoot, "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");

assert.match(html, /Noto(?:\+| )Serif(?:\+| )KR/);
assert.match(html, /Noto(?:\+| )Sans(?:\+| )KR/);
assert.match(css, /--seafoam:/);
assert.match(css, /--peach:/);
assert.match(css, /body::before/);
assert.match(css, /@media\(max-width:760px\)/);
process.stdout.write("coastal style contract passed\n");
