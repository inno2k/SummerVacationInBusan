# Coastal Summer Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Busan travel planner as a bright mint, ivory, and peach-coral summer coast experience without changing travel-planning behavior.

**Architecture:** Keep the static site structure and JavaScript behavior intact. Update the Google Fonts import and CSS design tokens, then use a small static contract test to protect the font import and essential coastal style selectors. Verify the finished page visually at desktop and mobile sizes while exercising existing interactive flows.

**Tech Stack:** Static HTML, CSS custom properties, Google Fonts, vanilla JavaScript, Node.js test runner, Leaflet, GitHub Pages.

---

### Task 1: Protect the visual asset contract

**Files:**
- Create: `docs/assets/css/styles.test.js`
- Modify: `docs/index.html`

- [ ] **Step 1: Write the failing visual asset contract test**

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const docsRoot = path.resolve(__dirname, "../..");
const html = fs.readFileSync(path.join(docsRoot, "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");

assert.match(html, /Noto Serif KR/);
assert.match(html, /Noto Sans KR/);
assert.match(css, /--seafoam:/);
assert.match(css, /--peach:/);
assert.match(css, /body::before/);
assert.match(css, /@media\(max-width:760px\)/);
process.stdout.write("coastal style contract passed\n");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node docs/assets/css/styles.test.js`

Expected: `AssertionError` because `Noto Serif KR`, `--seafoam`, and the coastal background selector are not present yet.

- [ ] **Step 3: Add the Korean serif family to the existing Google Fonts request**

Replace the current font request in `docs/index.html` with:

```html
<link href="https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=Noto+Sans+KR:wght@400;500;700;800&family=Noto+Serif+KR:wght@600;700;800&display=swap" rel="stylesheet" />
```

- [ ] **Step 4: Run the contract test and commit the asset contract**

Run: `node docs/assets/css/styles.test.js`

Expected: it still fails until Task 2 adds the CSS tokens and background selector.

Commit after Task 2 so the test and implementation land together.

### Task 2: Apply the coastal token system and responsive component treatment

**Files:**
- Modify: `docs/assets/css/styles.css`
- Test: `docs/assets/css/styles.test.js`

- [ ] **Step 1: Replace the root token block with the approved palette and display font**

```css
:root {
  --sea: #0f7892;
  --seafoam: #dff7f4;
  --sky: #edfaff;
  --deep: #12475c;
  --foam: #fffdf7;
  --sand: #f4e5c7;
  --peach: #ef8e7d;
  --coral: #df705f;
  --ink: #183e4e;
  --muted: #58727a;
  --line: #cbe5e2;
  --card: rgba(255, 255, 255, 0.92);
  --shadow: 0 16px 36px rgba(18, 71, 92, 0.10);
  --radius: 8px;
  --font: "Noto Sans KR", sans-serif;
  --display: "Noto Serif KR", serif;
}
```

- [ ] **Step 2: Add subtle CSS-only sky, seafoam, and sand background layers**

```css
body {
  margin: 0;
  background: var(--foam);
  color: var(--ink);
  font-family: var(--font);
  line-height: 1.6;
  overflow-x: hidden;
  position: relative;
}

body::before {
  background: linear-gradient(180deg, var(--sky) 0, var(--seafoam) 26rem, var(--foam) 48rem, var(--sand) 100%);
  content: "";
  inset: 0 0 auto;
  min-height: 42rem;
  pointer-events: none;
  position: absolute;
  z-index: -1;
}
```

- [ ] **Step 3: Restyle the hero, sticky tabs, cards, form controls, and map selectors**

Apply the following rules while retaining the existing selectors and layout tracks:

```css
.hero-panel { background: rgba(18, 71, 92, 0.96); border: 1px solid rgba(255, 255, 255, 0.3); }
.tabs { background: rgba(255, 253, 247, 0.86); backdrop-filter: blur(12px); }
.tabs button.active, .tabs button:hover { background: var(--sea); border-color: var(--sea); }
.card, .day-card, .source-card, .agent-card, .ops-card { background: var(--card); box-shadow: var(--shadow); }
.primary { background: var(--peach); box-shadow: 0 8px 18px rgba(223, 112, 95, 0.22); }
.primary:hover { background: var(--coral); }
.hero h1, .section-heading h2 { font-family: var(--display); }
```

Use `--seafoam`, `--sky`, `--sand`, and `--peach` for supporting panels, chips, borders, and selected controls. Keep coral limited to primary action and selected-state emphasis.

- [ ] **Step 4: Reduce decoration on mobile while preserving every existing responsive layout rule**

Add these declarations inside the existing `@media(max-width:760px)` block:

```css
body::before { min-height: 28rem; opacity: 0.72; }
.tabs { backdrop-filter: blur(8px); }
.hero-panel { box-shadow: 0 12px 26px rgba(18, 71, 92, 0.12); }
```

- [ ] **Step 5: Run the visual asset contract test**

Run: `node docs/assets/css/styles.test.js`

Expected: `coastal style contract passed`

- [ ] **Step 6: Commit the approved style system**

```bash
git add docs/index.html docs/assets/css/styles.css docs/assets/css/styles.test.js
git commit -m "style: add coastal summer visual system"
```

### Task 3: Verify behavior and responsive appearance

**Files:**
- Test: `docs/assets/css/styles.test.js`
- Test: `docs/assets/js/trip-agents.test.js`
- Test: `docs/qa-server.test.js`

- [ ] **Step 1: Run automated checks**

```bash
node docs/assets/css/styles.test.js
node --test docs/assets/js/trip-agents.test.js
node docs/qa-server.test.js
node --check docs/assets/js/app.js
node --check docs/assets/js/trip-agents.js
```

Expected: all checks pass with no JavaScript syntax errors.

- [ ] **Step 2: Run the site locally and inspect desktop and mobile widths**

```bash
node docs/qa-server.js
```

Open `http://127.0.0.1:4173` at a desktop viewport and a 390px-wide mobile viewport. Confirm headings render in Noto Serif KR, operational text remains in Noto Sans KR, background layers do not obscure text, and buttons keep at least 44px touch height.

- [ ] **Step 3: Exercise critical interactions after the style change**

At each viewport, verify:

```text
1. Change the 18일 overview input to “송도 케이블카와 감천문화마을” and press 전체 일정 재계산.
2. Confirm 일정, 탐색, and 식사 show 송도·감천 outputs.
3. Select 알뜰, then confirm the free 광안리 course appears in 일정, 탐색, and 식사.
4. Select 여유, then confirm 스카이라인 루지가 일정 and 탐색에 appears.
```

- [ ] **Step 4: Commit the verified result if verification required any adjustment**

```bash
git add docs/assets/css/styles.css docs/assets/css/styles.test.js docs/index.html
git commit -m "fix: refine coastal style responsiveness"
```

Only create this commit when Step 2 or Step 3 required a source change.
