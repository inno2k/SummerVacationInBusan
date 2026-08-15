# Day 16 Markets and Flow Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the August 16 itinerary around Ijaemo Pizza, Busan Science Experience Hall, Choryang Traditional Market, and Bupyeong Kkangtong Market; remove Lotte World Busan; and visually group flow inputs by date.

**Architecture:** Keep the trip JSON as the single itinerary source. `trip-agents.js` continues to derive every tab from that source, while `app.js` only changes the flow-editor HTML structure and `styles.css` owns the responsive card presentation. Existing Node tests validate the data contract and static-rendering hooks.

**Tech Stack:** Static HTML, vanilla JavaScript, JSON fixture data, CSS, Node.js built-in test runner, Playwright E2E.

---

### Task 1: Add failing fixture expectations for the new itinerary

**Files:**
- Modify: `docs/assets/js/trip-agents.test.js:183-257`
- Modify: `docs/qa-server.test.js:121-188`

- [ ] **Step 1: Replace stale day-16 and day-18 expectations with the approved itinerary contract**

```js
test("day 16 connects lunch, science, both markets, and hotel in order", () => {
  const result = runTripOrchestrator(itineraryFixture);
  const day16 = result.days.find((day) => day.date === "2026-08-16");

  assert.deepEqual(day16.route.sequence, [
    "부산역", "아스티호텔 부산", "이재모피자", "부산과학체험관",
    "초량전통시장", "부평깡통시장", "아스티호텔 부산"
  ]);
  assert.equal(day16.blocks.some((block) => block.title.includes("이재모피자")), true);
  assert.equal(day16.blocks.some((block) => block.title.includes("부산과학체험관")), true);
  assert.equal(day16.blocks.some((block) => block.title.includes("초량전통시장")), true);
  assert.equal(day16.blocks.some((block) => block.title.includes("부평깡통시장")), true);
});

test("the fixture no longer exposes Lotte World Busan", () => {
  const serialized = JSON.stringify(itineraryFixture);
  assert.doesNotMatch(serialized, /롯데월드 부산/);
});
```

- [ ] **Step 2: Add meal assertions covering Ijaemo Pizza and all three Bupyeong dinner options**

```js
test("day 16 offers Ijaemo Pizza and Bupyeong dinner choices", () => {
  const lunch = itineraryFixture.mealSlots["2026-08-16"].lunch;
  const dinner = itineraryFixture.mealSlots["2026-08-16"].dinner;

  assert.equal(lunch.some((candidate) => candidate.name === "이재모피자"), true);
  for (const name of ["양산집", "깡통골목할매 유부전골", "부평통닭"]) {
    assert.equal(dinner.some((candidate) => candidate.name === name), true);
  }
});
```

- [ ] **Step 3: Add static UI contract checks for date cards**

```js
function testAppGroupsFlowInputsByDateCard() {
  assert.match(appSource, /day-flow-card/);
  assert.match(appSource, /day-flow-card__header/);
  assert.match(appSource, /data-flow-date/);
  assert.match(appSource, /data-custom-request-date/);
  assert.match(appSource, /data-custom-request-area/);
}
```

Call `testAppGroupsFlowInputsByDateCard()` in the existing `try` block.

- [ ] **Step 4: Run the focused tests to verify failure**

Run: `npm.cmd test -- docs/assets/js/trip-agents.test.js docs/qa-server.test.js`

Expected: failing assertions for the old itinerary and missing `day-flow-card` markup.

- [ ] **Step 5: Commit the failing test change**

```powershell
git add docs/assets/js/trip-agents.test.js docs/qa-server.test.js
git commit -m "test: define day 16 market itinerary contract"
```

### Task 2: Update the single itinerary fixture and remove Lotte World

**Files:**
- Modify: `docs/assets/data/busan-family-trip-2026.json`
- Test: `docs/assets/js/trip-agents.test.js`

- [ ] **Step 1: Replace the day-16 blocks, route sequence, and map points**

Set `defaultBlocks["2026-08-16"]` to these ordered ranges, preserving the existing `{ time, startAt, endAt, title, type }` shape:

```json
[
  { "time": "10:46", "startAt": "10:46", "endAt": "11:30", "title": "부산역 도착·아스티호텔 짐 보관", "type": "fixed" },
  { "time": "점심", "startAt": "12:00", "endAt": "13:10", "title": "이재모피자 점심", "type": "food" },
  { "time": "오후", "startAt": "13:40", "endAt": "15:30", "title": "부산과학체험관 체험", "type": "activity" },
  { "time": "오후", "startAt": "15:40", "endAt": "17:10", "title": "초량전통시장 탐방·간식", "type": "place" },
  { "time": "저녁", "startAt": "18:00", "endAt": "20:20", "title": "부평깡통시장 저녁·야시장 탐방", "type": "food" },
  { "time": "밤", "startAt": "20:20", "endAt": "20:50", "title": "아스티호텔 부산 복귀", "type": "transport" }
]
```

Use the same ordered names for `routeSequences["2026-08-16"]` and `mapRoutePoints["16일"]`. Add coordinates for new named locations to `mapPlaceCatalog` where a point is not already embedded in the route list.

- [ ] **Step 2: Replace day-16 meal candidates and selections**

Make `이재모피자` the lunch candidate selected by every budget mode. Set the three dinner candidates to `양산집`, `깡통골목할매 유부전골`, and `부평통닭`, with distinct `genre`, `area`, `url`, and `note` fields. Map light, balanced, and comfort to different dinner names while retaining the global unique-primary-genre rule.

- [ ] **Step 3: Remove Lotte World from every fixture path**

Delete its default block, activity candidate, map route point, catalog entry, and budget-plan references. Update day 18 so National Busan Science Museum is the rainy-day candidate and Skyline Luge remains the clear-day candidate. Ensure every remaining day-18 route point has a catalog coordinate.

- [ ] **Step 4: Run fixture tests to verify the data contract passes**

Run: `npm.cmd test -- docs/assets/js/trip-agents.test.js`

Expected: PASS, including new day-16 route and Lotte World absence tests.

- [ ] **Step 5: Commit the fixture update**

```powershell
git add docs/assets/data/busan-family-trip-2026.json docs/assets/js/trip-agents.test.js
git commit -m "feat: rebuild day 16 market itinerary"
```

### Task 3: Render daily flow inputs as explicit card groups

**Files:**
- Modify: `docs/assets/js/app.js:79-85`
- Modify: `docs/assets/css/styles.css:flow-editor rules and mobile media query`
- Test: `docs/qa-server.test.js`

- [ ] **Step 1: Replace the flat flow rows with a semantic date-card template**

Update `renderFlowEditor()` so each `context.dayFlows` item returns one card, preserving the existing input ids and data attributes:

```js
return `<section class="day-flow-card" aria-labelledby="flow-heading-${day.date}">
  <header class="day-flow-card__header">
    <h3 id="flow-heading-${day.date}">${escapeHtml(day.label)} 일정</h3>
    <p>${escapeHtml(day.intent)}</p>
  </header>
  <div class="flow-row">
    <label for="flow-${day.date}">기본 일정</label>
    <input id="flow-${day.date}" data-flow-date="${day.date}" value="${escapeHtml(day.intent)}" />
  </div>
  <div class="flow-row flow-row--request">
    <label for="request-${day.date}">추가 요청</label>
    <input id="request-${day.date}" data-custom-request-date="${day.date}" value="${escapeHtml(request?.title || "")}" placeholder="비어 있는 시간에 넣을 요청 1건" />
    <label for="request-${day.date}-area">권역</label>
    <input id="request-${day.date}-area" data-custom-request-area="${day.date}" value="${escapeHtml(request?.area || "")}" placeholder="예: 오시리아" />
  </div>
</section>`;
```

- [ ] **Step 2: Add responsive card CSS without changing existing input storage behavior**

```css
.day-flow-card{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--sea);border-radius:var(--radius);padding:16px;box-shadow:var(--shadow)}
.day-flow-card__header{display:flex;justify-content:space-between;gap:16px;align-items:baseline;border-bottom:1px solid var(--line);margin-bottom:14px;padding-bottom:10px}
.day-flow-card__header h3{font-size:18px;margin:0}.day-flow-card__header p{color:var(--muted);font-size:13px;margin:0}
.flow-row--request{grid-template-columns:110px 1fr 52px minmax(140px,.45fr);margin-top:10px}
@media(max-width:760px){.day-flow-card{padding:14px}.day-flow-card__header{align-items:flex-start;flex-direction:column;gap:2px}.flow-row--request{grid-template-columns:1fr;gap:3px}}
```

- [ ] **Step 3: Run static UI contract tests**

Run: `npm.cmd test -- docs/qa-server.test.js`

Expected: PASS, including the date-card selector and existing custom-request storage tests.

- [ ] **Step 4: Commit the visual grouping change**

```powershell
git add docs/assets/js/app.js docs/assets/css/styles.css docs/qa-server.test.js
git commit -m "feat: group daily flow inputs into cards"
```

### Task 4: Verify the full experience and publish

**Files:**
- Modify only if test evidence reveals an issue: `docs/assets/data/busan-family-trip-2026.json`, `docs/assets/js/app.js`, `docs/assets/css/styles.css`

- [ ] **Step 1: Run the complete automated suite**

Run: `npm.cmd test`

Expected: PASS with no stale Lotte World or old day-16 assertions.

- [ ] **Step 2: Build the static site**

Run: `npm.cmd run build`

Expected: successful production build.

- [ ] **Step 3: Run browser E2E verification**

Run: `npm.cmd run test:e2e -- --reporter=line`

Expected: PASS. Verify desktop and mobile views visually show four separated date cards, budget switching changes selected dinner without duplicated primary genres, and the 16th map filter shows the new pin order.

- [ ] **Step 4: Review the final diff and commit only any necessary correction**

Run: `git diff --check; git status -sb`

Expected: no whitespace errors and a clean worktree after existing task commits.

- [ ] **Step 5: Push to GitHub Pages source branch after all checks pass**

```powershell
git push origin main
```

- [ ] **Step 6: Verify the GitHub Pages Action reaches `success` and spot-check the public site**

Check the newest `pages build and deployment` workflow, then open `https://inno2k.github.io/SummerVacationInBusan/` and confirm the new 16th route and flow-card separation are live.
