# Busan Tokidoki-Style Trip Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild SummerVacationInBusan as a Tokidoki-style static travel planner whose trip manager recomputes the itinerary when a day flow changes.

**Architecture:** Keep Tokidoki's GitHub Pages shape under `docs/`, with JSON as the trip source of truth and a small browser-side orchestration engine. A deterministic manager coordinates focused specialist agents for schedule, route, lodging, transport, food, and activities, then validates conflicts and exposes the reasoning/warnings in the UI. No server or API key is required.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, JSON, Leaflet, Node.js built-in test runner, static HTTP QA server.

---

### Task 1: Define the agent contract and trip data

**Files:**
- Create: `docs/03-analysis/busan-trip-agent-rebuild.plan.md`
- Create: `docs/superpowers/specs/2026-08-07-busan-trip-agent-design.md`
- Create: `docs/assets/data/busan-family-trip-2026.json`

- [ ] **Step 1: Record immutable trip constraints**

  Store the KTX times, the Asti/Paradise hotel split, the 16-19 August flow, and the rule that 17 August owns the Haeundae water-play block while 18 August is a different Busan experience day.

- [ ] **Step 2: Define the manager input/output contract**

  Use `tripContext` for constraints, `dayFlows` for user-entered intent, and `orchestrationResult` for the ordered day plan, specialist outputs, decisions, and warnings. Keep the contract serializable so it can be edited in the UI and persisted in localStorage.

- [ ] **Step 3: Add the source-backed Busan content**

  Include 10 Shorts and 10 longform YouTube records with title, URL, format, role, and places/foods extracted from the requested search. Keep time-sensitive operating details marked for recheck.

### Task 2: Implement deterministic specialist agents

**Files:**
- Create: `docs/assets/js/trip-agents.js`
- Create: `docs/assets/js/trip-agents.test.js`

- [ ] **Step 1: Write failing unit tests for the specialist contracts**

  Cover hotel-change detection, KTX buffer validation, Haeundae water-play placement on 17 August, and 18 August non-Haeundae activity selection.

- [ ] **Step 2: Implement pure specialist functions**

  Implement `scheduleAgent`, `routeAgent`, `lodgingAgent`, `transportAgent`, `foodAgent`, and `activityAgent`. Each returns `{ agentId, recommendations, constraints, warnings }` and does not mutate the input.

- [ ] **Step 3: Implement the manager pipeline**

  Implement `runTripOrchestrator(context)` with this order: schedule -> route -> lodging -> transport -> food -> activities -> validation. Re-run all specialists on a changed day flow because this four-day trip is small and cross-agent dependencies are substantial.

- [ ] **Step 4: Run the focused unit tests**

  Run `node --test docs/assets/js/trip-agents.test.js`. Expected: all tests pass.

### Task 3: Port the Tokidoki shell and wire the manager

**Files:**
- Create/modify: `docs/index.html`
- Create/modify: `docs/assets/css/styles.css`
- Create/modify: `docs/assets/js/app.js`
- Create: `docs/.nojekyll`

- [ ] **Step 1: Add the Tokidoki-style tab shell**

  Preserve the overview, itinerary, operations, explore, festival, budget, food, shopping, and verify surfaces, changing Tokyo content and labels to Busan.

- [ ] **Step 2: Add editable day-flow controls**

  Give each day a text input/selectable intent field. A single `재계산` action sends the edited flow through `runTripOrchestrator` and refreshes itinerary, route, meal, activity, and warning panels.

- [ ] **Step 3: Persist and restore the active plan**

  Store user-entered flows and checklists under Busan-specific localStorage keys. Invalid stored JSON falls back to the canonical data file.

- [ ] **Step 4: Keep static hosting safe**

  Use relative asset paths, no backend calls, and visible source/recheck links for current facility information.

### Task 4: Add route/map, source, and QA surfaces

**Files:**
- Modify: `docs/assets/js/app.js`
- Modify: `docs/assets/data/busan-family-trip-2026.json`
- Create/modify: `docs/qa-server.js`
- Create/modify: `docs/qa-server.test.js`

- [ ] **Step 1: Add Busan map points and route anchors**

  Cover Seoul Station, Busan Station, Asti Hotel, Paradise Hotel Busan, Choryang, Nampo/Jagalchi, Yeongdo, Haeundae, Cheongsapo, Osiria, Gwangalli, and Centum.

- [ ] **Step 2: Add source verification cards**

  Separate YouTube inspiration from official transport, hotel, attraction, and operating-time rechecks.

- [ ] **Step 3: Preserve traversal/malformed-URI QA coverage**

  Run `node docs/qa-server.test.js` and ensure the static server still rejects malformed and escaping paths.

### Task 5: Verify the complete static app

**Files:**
- Modify: `docs/03-analysis/busan-trip-agent-rebuild.plan.md`
- Create: `docs/04-report/busan-trip-agent-rebuild.report.md`

- [ ] **Step 1: Run syntax and data checks**

  Run `node --check docs/assets/js/app.js`, `node --check docs/assets/js/trip-agents.js`, and parse both JSON files with Node.

- [ ] **Step 2: Run all Node tests**

  Run `node --test docs/assets/js/trip-agents.test.js docs/qa-server.test.js`. Expected: all tests pass.

- [ ] **Step 3: Run the static server and smoke-test the app**

  Start `node docs/qa-server.js`, load `/`, verify the initial itinerary, edit one day flow, click `재계산`, and verify that the day plan and warnings change without a page reload.

- [ ] **Step 4: Perform responsive visual verification**

  Check desktop and mobile widths for tab navigation, day-flow inputs, map, source cards, and warning text. Confirm no text overlap and no blank map canvas.

- [ ] **Step 5: Write the completion report**

  Record changed files, the orchestration behavior, exact verification commands, and any live-information rechecks that remain user-dependent.
