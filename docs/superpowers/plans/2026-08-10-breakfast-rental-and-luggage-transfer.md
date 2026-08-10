# Breakfast, Rental, and Luggage Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add daily breakfast, the 17 August rental-car/Haedong Yonggungsa flow, and the 19 August Zim Carry plus Haeundae Rib Barbecue Restaurant flow while keeping every budget mode and tab consistent.

**Architecture:** Keep docs/assets/data/busan-family-trip-2026.json as the sole trip source. Extend generic meal slots with breakfast, add rental and luggage metadata, and have specialist agents expose that metadata in normal outputs. The app renders labels and operational cards from those outputs instead of duplicating itinerary decisions.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Node.js built-in test runner, Leaflet, JSON fixture data.

---

## File Map

- Modify: docs/assets/data/busan-family-trip-2026.json - blocks, meals, maps, rental/luggage data, and budgets.
- Modify: docs/assets/js/trip-agents.js - generic meal labels, transport outputs, warnings, validation.
- Modify: docs/assets/js/trip-agents.test.js - agent-level behavior coverage.
- Modify: docs/assets/js/app.js - meal labels and logistics-card rendering.
- Modify: docs/qa-server.test.js - fixture and UI contract checks.
- Modify: docs/assets/css/styles.css and docs/assets/css/styles.test.js - responsive logistics links.

### Task 1: Define the Trip Data Contract

**Files:**
- Modify: docs/assets/data/busan-family-trip-2026.json
- Test: docs/qa-server.test.js

- [ ] **Step 1: Write the failing fixture check**

Add and invoke this test function:

~~~js
function testTripFixtureIncludesBreakfastAndLogistics() {
  for (const [date, slots] of Object.entries(tripFixture.mealSlots)) {
    assert.ok(slots.breakfast, `${date} needs a breakfast slot`);
    assert.ok(slots.breakfast.length >= 3, `${date} breakfast needs three candidates`);
  }
  assert.equal(tripFixture.rentalOptions.providers.length, 2);
  assert.deepEqual(
    tripFixture.rentalOptions.providers.map((provider) => provider.name),
    ["SK Rent-a-Car Busan Station", "Lotte Rent-a-Car Busan Station"]
  );
  assert.match(tripFixture.luggageTransfer.url, /^https:\/\//);
  assert.equal(tripFixture.luggageTransfer.destination, "Busan Station");
}
~~~

- [ ] **Step 2: Run it to verify failure**

Run: node docs/qa-server.test.js

Expected: a missing breakfast slot or rentalOptions failure.

- [ ] **Step 3: Add minimal fixture data**

Add breakfast candidate arrays to each mealSlots date. Each entry uses the existing object shape:

~~~json
{
  "name": "Restaurant name",
  "genre": "unique genre",
  "area": "local area",
  "meal": "breakfast",
  "url": "https://...",
  "note": "Why this fits before the next fixed movement"
}
~~~

Use Seoul Station before the 16th 07:58 KTX, Busan Station/Asti before the 17th rental, Haeundae before the 18th Osiria day, and Mipo/Haeundae before the 19th checkout. Add breakfast selections and priorities for light, balanced, and comfort. Selected genres must remain unique in each mode.

Add exactly this top-level data:

~~~json
"rentalOptions": {
  "date": "2026-08-17",
  "pickup": "Busan Station",
  "returnPlan": "Haeundae-area same-day return; Busan Station return if unavailable",
  "providers": [
    { "name": "SK Rent-a-Car Busan Station", "address": "Jungang-daero 180beon-gil 12", "url": "https://www.skcarrental.com/", "note": "Confirm Haeundae same-day return when booking." },
    { "name": "Lotte Rent-a-Car Busan Station", "address": "Jungang-daero 248beon-gil 7-7", "url": "https://www.lotterentacar.net/hp/kor/info/allBranchArea.do", "note": "Confirm Haeundae same-day return when booking." }
  ]
},
"luggageTransfer": {
  "date": "2026-08-19",
  "name": "Zim Carry",
  "origin": "Paradise Hotel Busan",
  "destination": "Busan Station",
  "collection": "Busan Station first-floor meeting hall",
  "url": "https://zimcarry.net/",
  "note": "Reserve in advance and reconfirm collection cutoff.",
  "confirmed": true
}
~~~

Update blocks, routeSequences, mapRoutePoints, and mapPlaceCatalog together:

~~~text
17th: Asti -> rental pickup -> Paradise luggage drop -> Haedong Yonggungsa ->
      Mipo parking -> Mipo/Cheongsapo round-trip Blue Line Park -> Paradise
      water activity -> Haeundae Beach -> Haeundae-area rental return
19th: Paradise checkout -> Zim Carry handoff -> Haeundae Rib Barbecue Restaurant
      -> Busan Station Zim Carry collection -> boarding buffer -> 14:31 KTX
~~~

Replace 19th Busan Station lunch selections with the requested galbi lunch. Update every budget total/detail for four breakfasts, one rental day, and Zim Carry. Add current-information links for both rental providers, Zim Carry, Haedong Yonggungsa, and the restaurant to recheckSources.

- [ ] **Step 4: Run test to verify it passes**

Run: node docs/qa-server.test.js

Expected: qa-server tests passed.

- [ ] **Step 5: Commit**

~~~powershell
git add docs/assets/data/busan-family-trip-2026.json docs/qa-server.test.js
git commit -m "feat: add breakfast and travel logistics data"
~~~

### Task 2: Make Agents Emit and Validate the New Flow

**Files:**
- Modify: docs/assets/js/trip-agents.js
- Modify: docs/assets/js/trip-agents.test.js

- [ ] **Step 1: Write failing orchestration tests**

~~~js
test("orchestrator provides breakfast for every day and preserves unique genres", () => {
  for (const budgetMode of ["light", "balanced", "comfort"]) {
    const result = runTripOrchestrator({ ...itineraryFixture, budgetMode });
    const slots = result.days.flatMap((day) => day.meals.slots);
    const primaryGenres = slots.map((slot) => slot.primary.genre);
    assert.equal(slots.filter((slot) => slot.meal === "breakfast").length, 4);
    assert.equal(new Set(primaryGenres).size, primaryGenres.length);
  }
});

test("orchestrator orders rental and luggage routes", () => {
  const result = runTripOrchestrator(itineraryFixture);
  const day17 = result.days.find((day) => day.date === "2026-08-17");
  const day19 = result.days.find((day) => day.date === "2026-08-19");
  assert.equal(day17.route.sequence.includes("Haedong Yonggungsa"), true);
  assert.equal(day17.route.sequence.indexOf("Haedong Yonggungsa") < day17.route.sequence.indexOf("Mipo parking"), true);
  assert.equal(day19.route.sequence.includes("Haeundae Rib Barbecue Restaurant"), true);
  assert.equal(day19.route.sequence.indexOf("Haeundae Rib Barbecue Restaurant") < day19.route.sequence.indexOf("Busan Station"), true);
  assert.equal(day19.blocks.some((block) => block.title.includes("Zim Carry")), true);
});
~~~

- [ ] **Step 2: Run tests to verify failure**

Run: node --test docs/assets/js/trip-agents.test.js

Expected: the new assertions fail before implementation.

- [ ] **Step 3: Implement generic labels and logistics outputs**

Add one generic meal label map and use it in foodAgent:

~~~js
const MEAL_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner"
};

function mealLabel(meal) {
  return MEAL_LABELS[meal] || meal;
}
~~~

Replace the lunch/dinner ternary in the food summary with:

~~~js
slots.map((slot) => `${mealLabel(slot.meal)}: ${slot.candidates[0].name}`);
~~~

In transportAgent, append data-driven rental and luggage entries:

~~~js
const rental = context.rentalOptions;
const luggage = context.luggageTransfer;

if (rental) {
  recommendations.push({
    date: rental.date,
    title: "Rental car",
    detail: `${rental.pickup}; ${rental.returnPlan}`,
    providers: rental.providers
  });
}
if (luggage) {
  recommendations.push({
    date: luggage.date,
    title: luggage.name,
    detail: `${luggage.origin} -> ${luggage.destination}; ${luggage.collection}`,
    logistics: luggage
  });
}
~~~

Extend validate with required 17th and 19th route names plus provider/link checks. Remove the obsolete rule that forbids Haeundae on the 19th. Update decisions to mention rental, Zim Carry, and the KTX buffer.

- [ ] **Step 4: Run tests to verify they pass**

Run: node --test docs/assets/js/trip-agents.test.js

Expected: all existing and new subtests pass.

- [ ] **Step 5: Commit**

~~~powershell
git add docs/assets/js/trip-agents.js docs/assets/js/trip-agents.test.js
git commit -m "feat: orchestrate breakfast and transfer logistics"
~~~

### Task 3: Render Meals and Logistics Across Tabs

**Files:**
- Modify: docs/assets/js/app.js
- Modify: docs/qa-server.test.js
- Modify: docs/assets/css/styles.css
- Modify: docs/assets/css/styles.test.js

- [ ] **Step 1: Write failing UI checks**

~~~js
function testAppRendersBreakfastAndTransportLogistics() {
  assert.match(appSource, /breakfast:/);
  assert.match(appSource, /providers/);
  assert.match(appSource, /logistics/);
  assert.match(appSource, /safeExternalUrl\(provider\.url\)/);
  assert.match(appSource, /safeExternalUrl\(logistics\.url\)/);
}
~~~

When adding a links class, add matching CSS checks:

~~~js
assert.match(css, /\.ops-card__links\{/);
assert.match(css, /\.ops-card__links a\{/);
~~~

- [ ] **Step 2: Run checks to verify failure**

Run: node docs/qa-server.test.js; node docs/assets/css/styles.test.js

Expected: the new app-source checks fail.

- [ ] **Step 3: Implement display helpers and logistics cards**

Add this app helper and use it in conciseMealSummary and renderFood headings/tags:

~~~js
function mealLabel(meal) {
  return ({ breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" })[meal] || meal;
}
~~~

In renderOps, read 17th and 19th transport recommendations. Render provider and Zim Carry links only through the existing sanitizer:

~~~js
const logisticsCard = (item) => {
  const providers = item.providers || [];
  const logistics = item.logistics ? [item.logistics] : [];
  const links = [...providers, ...logistics]
    .filter((entry) => entry.url)
    .map((entry) => `<a href="${escapeHtml(safeExternalUrl(entry.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.name || "Booking information")} -></a>`)
    .join("");
  return { title: item.title, body: item.detail, links };
};
~~~

Render links only when non-empty. Add ops-card__links styles using wrapping flex layout, existing action colors, and the mobile media query.

- [ ] **Step 4: Run checks to verify they pass**

Run: node docs/qa-server.test.js; node docs/assets/css/styles.test.js; node --check docs/assets/js/app.js

Expected: qa-server tests passed, coastal style contract passed, and no syntax output.

- [ ] **Step 5: Commit**

~~~powershell
git add docs/assets/js/app.js docs/qa-server.test.js docs/assets/css/styles.css docs/assets/css/styles.test.js
git commit -m "feat: render breakfast and rental logistics"
~~~

### Task 4: Full Regression and Browser Verification

**Files:**
- Modify: docs/qa-server.test.js only if failed verification reveals an uncovered contract.

- [ ] **Step 1: Run static regression**

~~~powershell
node --test docs/assets/js/trip-agents.test.js
node docs/qa-server.test.js
node docs/assets/css/styles.test.js
node --check docs/assets/js/app.js
node --check docs/assets/js/trip-agents.js
node -e "JSON.parse(require('fs').readFileSync('docs/assets/data/busan-family-trip-2026.json','utf8')); console.log('json ok')"
~~~

Expected: every command exits with code 0 and the final command prints json ok.

- [ ] **Step 2: Verify all budget modes and recalculation**

Start node docs/qa-server.js. In light, balanced, and comfort, inspect 16th, 17th, and 19th map filters; highlighted pins and drawing order must match the itinerary. Trigger full recalculation and confirm breakfast, rental, Zim Carry, galbi lunch, and 14:31 KTX remain fixed while selected foods and budget detail change.

- [ ] **Step 3: Verify responsive layout**

Inspect itinerary, transport, food, explore, and budget tabs at desktop and mobile widths. Confirm logistics links are tappable, text does not overlap, and cards wrap without horizontal overflow.

- [ ] **Step 4: Commit a regression guard only if code changed**

~~~powershell
git add docs/qa-server.test.js
git commit -m "test: cover breakfast and logistics regression"
~~~

Skip this commit when Task 4 changes no tracked file.

- [ ] **Step 5: Confirm final tree and publish**

Run: git status -sb

Expected: no uncommitted changes. Push completed commits to origin/main, then verify the GitHub Pages workflow and public page after deployment.
