# Meal Uniqueness And Open Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent repeated primary meal genres across the trip and automatically place one new request per day into a safe open time.

**Architecture:** JSON records block time ranges, a primary restaurant per meal and optional custom requests. The orchestrator derives primary meals and open slots, then validates global meal uniqueness and fixed travel constraints. The app renders the derived slots and submits one request per date to local storage.

**Tech Stack:** Static GitHub Pages, Vanilla JavaScript, JSON, Node built-in test runner.

---

### Task 1: Normalize primary meals and time ranges

**Files:**
- Modify: `docs/assets/data/busan-family-trip-2026.json`
- Modify: `docs/assets/js/trip-agents.test.js`

- [ ] **Step 1: Write failing fixture tests**

```js
test("primary meal genres and Anmok occur once across the whole trip", () => {
  const result = runTripOrchestrator(itineraryFixture);
  const primary = result.days.flatMap((day) => day.meals.slots.map((slot) => slot.primary));
  assert.equal(new Set(primary.map((meal) => meal.genre)).size, primary.length);
  assert.equal(primary.filter((meal) => meal.name.includes("안목")).length, 1);
  assert.equal(primary.find((meal) => meal.name.includes("안목")).area, "부산역");
});
```

- [ ] **Step 2: Confirm failure**

Run: `node --test docs/assets/js/trip-agents.test.js`

Expected: FAIL because candidates do not yet identify a primary and 안목 appears in more than one slot.

- [ ] **Step 3: Add primary and timing data**

Set exactly one `primary: true` candidate in every `mealSlots[date][meal]`. Remove every 안목 candidate except `2026-08-19.lunch` 부산역점. Give all default blocks `startAt` and `endAt` values, retaining KTX, hotel and water activity times. The eight primary genres must be unique.

- [ ] **Step 4: Verify and commit**

Run: `node --test docs/assets/js/trip-agents.test.js`

Expected: primary fixture test passes.

```bash
git add docs/assets/data/busan-family-trip-2026.json docs/assets/js/trip-agents.test.js
git commit -m "data: define unique meals and time ranges"
```

### Task 2: Derive open slots and place one custom request

**Files:**
- Modify: `docs/assets/js/trip-agents.js`
- Modify: `docs/assets/js/trip-agents.test.js`

- [ ] **Step 1: Write failing orchestrator tests**

```js
test("one custom request is placed in the earliest compatible open slot", () => {
  const result = runTripOrchestrator({ ...itineraryFixture, customRequests: { "2026-08-18": [{ title: "기장 카페", area: "오시리아" }] } });
  const day18 = result.days.find((day) => day.date === "2026-08-18");
  assert.equal(day18.openSlot.status, "used");
  assert.equal(day18.blocks.some((block) => block.title === "기장 카페"), true);
});

test("a second request is not placed and creates a warning", () => {
  const result = runTripOrchestrator({ ...itineraryFixture, customRequests: { "2026-08-18": [{ title: "A" }, { title: "B" }] } });
  assert.equal(result.warnings.some((warning) => warning.includes("하루 한 건")), true);
});
```

- [ ] **Step 2: Confirm failure**

Run: `node --test docs/assets/js/trip-agents.test.js`

Expected: FAIL because `customRequests` and `openSlot` are not implemented.

- [ ] **Step 3: Implement pure placement helpers**

Add `primaryMeal`, `openSlotForDay`, and `placeCustomRequest` helpers. `scheduleAgent` must return `{ blocks, openSlot }`, append only the first compatible request, and never move `fixed`, `lodging`, `transport`, or `water` blocks. `foodAgent` returns each slot's selected primary plus alternatives.

- [ ] **Step 4: Extend total-manager validation**

Warn when primary genres repeat, Anmok is not exactly one 부산역 primary, a date has multiple requests, or no open slot can safely accept the request. Preserve current day 19 KTX validation.

- [ ] **Step 5: Verify and commit**

Run: `node --test docs/assets/js/trip-agents.test.js`

Expected: all agent tests pass.

```bash
git add docs/assets/js/trip-agents.js docs/assets/js/trip-agents.test.js
git commit -m "feat: place daily requests in open slots"
```

### Task 3: Render selected meals and one request input per day

**Files:**
- Modify: `docs/assets/js/app.js`
- Modify: `docs/index.html`
- Modify: `docs/qa-server.test.js`

- [ ] **Step 1: Write failing renderer checks**

```js
assert.match(appScript, /openSlot/);
assert.match(appScript, /customRequests/);
assert.match(appScript, /대표 선택/);
```

- [ ] **Step 2: Confirm failure**

Run: `node --test docs/qa-server.test.js`

Expected: FAIL because the current UI has no open-slot request controls.

- [ ] **Step 3: Render the derived state**

Show the primary restaurant separately from alternatives, then show each day’s `openSlot` as either `요청 대기`, the automatically placed request, or a conflict warning. Add one text input per date and persist it as one `customRequests[date]` entry alongside the existing day-flow storage. Recalculate must re-run placement and refresh itinerary, map and food tabs.

- [ ] **Step 4: Verify and commit**

Run: `node --test docs/qa-server.test.js && node --check docs/assets/js/app.js`

Expected: PASS.

```bash
git add docs/assets/js/app.js docs/index.html docs/qa-server.test.js
git commit -m "feat: render meal selections and open request slots"
```

### Task 4: Run end-to-end regression checks

**Files:**
- Modify: `docs/assets/js/trip-agents.test.js`
- Modify: `docs/qa-server.test.js`

- [ ] **Step 1: Add budget and recalculation coverage**

```js
test("every budget preserves unique primary meals and one-request limit", () => {
  for (const budgetMode of ["light", "balanced", "comfort"]) {
    const result = runTripOrchestrator({ ...itineraryFixture, budgetMode, customRequests: { "2026-08-16": [{ title: "초량 카페" }] } });
    assert.equal(result.days.filter((day) => day.openSlot.status === "used").length, 1);
  }
});
```

- [ ] **Step 2: Run all tests**

Run: `node --test docs/assets/js/trip-agents.test.js docs/assets/css/styles.test.js docs/qa-server.test.js`

Expected: PASS with zero failures.

- [ ] **Step 3: Commit verification coverage**

```bash
git add docs/assets/js/trip-agents.test.js docs/qa-server.test.js
git commit -m "test: cover meal uniqueness and open slots"
```

## Plan Self-Review

- The four tasks cover the data contract, agent placement and validation, all affected UI, and cross-budget recalculation.
- The helper names and result fields are used consistently: `primary`, `openSlot`, and `customRequests`.
- Every behavior change has a failing-test step and an exact command.
