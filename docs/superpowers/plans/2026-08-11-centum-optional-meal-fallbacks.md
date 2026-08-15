# Centum Optional Meal Fallbacks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 18 August Osiria flow with the approved Centum-Suyeong-Gwangalli route, show yacht and ice rink as non-default options, and expand the existing meal-candidates panel with five researched fallbacks per scheduled meal group.

**Architecture:** `docs/assets/data/busan-family-trip-2026.json` stays the only trip-data source. It separates confirmed day-18 blocks, optional experiences, selected meal slots, and `mealFallbacks`; agents validate those groups and protect confirmed route stops from budget overrides. The existing food panel renders selected meals plus fallbacks, and the itinerary renders options as information only.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Leaflet, JSON fixture data, Node.js built-in test runner.

---

## File Map

- Modify: `docs/assets/data/busan-family-trip-2026.json` - day 18 route, map pins, meal fallbacks, options, budgets, sources.
- Modify: `docs/assets/js/trip-agents.js` - fixed-route protection, options, fallback validation.
- Modify: `docs/assets/js/trip-agents.test.js` - orchestration regressions.
- Modify: `docs/assets/js/app.js` - option and fallback rendering in existing panels.
- Modify: `docs/assets/css/styles.css` and `docs/assets/css/styles.test.js` - responsive cards and contract checks.
- Modify: `docs/qa-server.test.js` - fixture and static-UI checks.

## Candidate Dossier

Create five additional fallbacks for each group below. Store Korean place names in
`name`, an HTTPS Naver Map search link in `url`, a nearby route reason in
`note`, and one of `go-now`, `check-wait`, or `operation-check` in
`waitRisk`. Keep selected itinerary restaurants unchanged.

| Date and group | Five fallback targets |
| --- | --- |
| 16 breakfast, Seoul Station | Paris Croissant Seoul Station; Dunkin Seoul Station; Lotteria Seoul Station; McDonald's Seoul Station; Isaac Toast Seoul Station |
| 16 lunch, Busan Station / Choryang / Nampo | Wonjo 18beon Wandang; Hongsungbang Main; Sinchang Gukbap; Gae Mi Jip Nampo; Halmae Gaya Milmyeon Nampo |
| 16 dinner, Choryang / Bupyeong markets | Kkangtong Alley Halmae Yubu Jeongol; Igane Tteokbokki; Wonjo Bibim Dangmyeon; Bupyeong Market Eomuk; Bupyeong Yang Gopchang |
| 17 breakfast, Busan Station / Asti | Bonjeon Dwaeji Gukbap; Choryang Milmyeon; Busan Station Gimbap; Busan Station Sandwich; Busan Station Salad |
| 17 lunch, Haedong Yonggungsa / Songjeong / Mipo | Haedong Yonggungsa Haemul Jjajang; Yeonhwari Haenyeochon; Songjeong 3dae Gukbap; Mipo Gaya Milmyeon; Songjeong Mun Toast |
| 17 dinner, Haeundae / Paradise | Geumsubokguk Haeundae; Haeundae Gijip Daegutang; Haeundae Gaya Milmyeon; Haeundae Somunnan Amsogalbi; Sangukine Haeundae |
| 18 breakfast, Haeundae / Paradise | Geumsubokguk Haeundae; Haeundae Gijip Daegutang; Millyang Sundae Dwaeji Gukbap Haeundae; Goraesa Eomuk Haeundae; OPS Haeundae |
| 18 lunch, Centum City / Museum 1 | Subyeon Choego Dwaeji Gukbap Centum; Chang Thai Noodle Centum; Haedamso Gopchang Sundae Guk; Bihaksan Boribap Saeng Kalguksu; Shinsegae Centum Food Hall |
| 18 dinner, Gwangalli | Eom Yongbaek Dwaeji Gukbap Gwangalli; Galsam Gui; Tonsyo Gwangalli; Millak Hoetawon; Gwangalli Eonyang Bulgogi |
| 19 breakfast, Haeundae / Paradise | Haeundae Gijip Daegutang; Geumsubokguk Haeundae; Haeundae Gaya Milmyeon; Goraesa Eomuk Haeundae; OPS Haeundae |
| 19 lunch, Haeundae Amsogalbi approach | Geodae Galbi; Haeundae Somunnan Amsogalbi; Haeundae Gijip Daegutang; Geumsubokguk Haeundae; Haeundae Gaya Milmyeon |
| 19 KTX boarding takeaway, Busan Station | Samjin Eomuk Busan Station; Goraesa Eomuk Busan Station; Busan Station Gimbap; Busan Station Bakery; Busan Station Coffee and Sandwich |

The 19 August final group uses the `takeaway` key and Korean label
`KTX 탑승 전 포장`; it replaces the obsolete Busan dinner slot because the
train departs at 14:31.

### Task 1: Define Failing Contracts

**Files:**
- Modify: `docs/qa-server.test.js`
- Modify: `docs/assets/js/trip-agents.test.js`

- [ ] **Step 1: Write fixture tests**

Add and invoke these checks in `docs/qa-server.test.js`:

```js
function testCentumRouteAndFallbackData() {
  const serialized = JSON.stringify(tripFixture);
  assert.doesNotMatch(serialized, /오시리아|국립부산과학관|스카이라인 루지|롯데월드/);

  const route = [
    "파라다이스호텔 부산", "부산엑스더스카이", "뮤지엄원",
    "부산영화의전당", "F1963", "광안리", "파라다이스호텔 부산"
  ];
  assert.deepEqual(tripFixture.routeSequences["2026-08-18"], route);
  assert.deepEqual(tripFixture.mapRoutePoints["18일"].map((point) => point.name), route);

  for (const [date, groups] of Object.entries(tripFixture.mealFallbacks)) {
    for (const [meal, candidates] of Object.entries(groups)) {
      assert.equal(candidates.length, 5, `${date} ${meal} needs five fallbacks`);
      assert.equal(new Set(candidates.map((candidate) => candidate.name)).size, 5);
      candidates.forEach((candidate) => {
        assert.match(candidate.url, /^https:\/\//);
        assert.ok(["go-now", "check-wait", "operation-check"].includes(candidate.waitRisk));
        assert.ok(candidate.note.length > 10);
      });
    }
  }
  assert.ok(tripFixture.mealFallbacks["2026-08-19"].takeaway);
  assert.equal(tripFixture.mealFallbacks["2026-08-19"].dinner, undefined);
}

function testOptionsAreOutsideBaseBudget() {
  const options = tripFixture.optionalExperiences["2026-08-18"];
  assert.deepEqual(options.map((option) => option.id), ["suyeong-yacht", "centum-ice-rink"]);
  options.forEach((option) => {
    assert.deepEqual(option.replaces, ["cinema-center", "f1963"]);
    assert.match(option.sourceUrl, /^https:\/\//);
    assert.ok(option.durationMinutes >= 60);
    assert.ok(option.conditions.length > 10);
  });
  Object.values(tripFixture.budgets).forEach((budget) => {
    assert.match(JSON.stringify(budget), /선택 체험.*예약/);
  });
}
```

- [ ] **Step 2: Write agent tests**

```js
test("every budget retains day 18 base route and options", () => {
  const expected = itineraryFixture.routeSequences["2026-08-18"];
  for (const budgetMode of ["light", "balanced", "comfort"]) {
    const result = runTripOrchestrator({ ...itineraryFixture, budgetMode });
    const day18 = result.days.find((day) => day.date === "2026-08-18");
    assert.deepEqual(day18.route.sequence, expected);
    assert.deepEqual(
      day18.activities.options.map((option) => option.id),
      ["suyeong-yacht", "centum-ice-rink"]
    );
    assert.equal(day18.blocks.some((block) => /오시리아|국립부산과학관|스카이라인 루지/.test(block.title)), false);
  }
});

test("food agent exposes five fallbacks without replacing selected meal", () => {
  const result = runTripOrchestrator({ ...itineraryFixture, budgetMode: "balanced" });
  const day18 = result.days.find((day) => day.date === "2026-08-18");
  const lunch = day18.meals.fallbacks.find((group) => group.meal === "lunch");
  assert.equal(lunch.candidates.length, 5);
  assert.equal(lunch.selected.name, day18.meals.slots.find((slot) => slot.meal === "lunch").primary.name);
});
```

- [ ] **Step 3: Run red tests**

Run:

```powershell
node docs/qa-server.test.js
node --test docs/assets/js/trip-agents.test.js
```

Expected: both commands fail because the fixture has neither the new day-18 data
nor options or fallback groups.

- [ ] **Step 4: Commit red tests**

```powershell
git add docs/qa-server.test.js docs/assets/js/trip-agents.test.js
git commit -m "test: define centum and meal fallback contracts"
```

### Task 2: Replace Day 18 and Add Data

**Files:**
- Modify: `docs/assets/data/busan-family-trip-2026.json`

- [ ] **Step 1: Replace all removed day-18 references**

Remove `오시리아`, `국립부산과학관`, `스카이라인 루지`, and
`롯데월드` from hero text, day flow, activities, route hubs, budget plans,
maps, and sources. Use these blocks, including stable IDs:

```json
[
  { "id": "haeundae-breakfast", "time": "08:00", "startAt": "08:00", "endAt": "09:00", "title": "해운대 아침식사·파라다이스호텔 출발", "type": "food" },
  { "id": "x-the-sky", "time": "09:30", "startAt": "09:30", "endAt": "11:00", "title": "부산엑스더스카이", "type": "activity" },
  { "id": "centum-lunch", "time": "11:15", "startAt": "11:15", "endAt": "12:45", "title": "센텀 이동·점심식사", "type": "food" },
  { "id": "museum-1", "time": "13:00", "startAt": "13:00", "endAt": "14:40", "title": "뮤지엄원 미디어아트", "type": "activity" },
  { "id": "cinema-center", "time": "15:00", "startAt": "15:00", "endAt": "15:45", "title": "부산영화의전당 광장", "type": "place" },
  { "id": "f1963", "time": "16:15", "startAt": "16:15", "endAt": "17:30", "title": "F1963 문화·휴식", "type": "place" },
  { "id": "gwangalli-dinner", "time": "18:00", "startAt": "18:00", "endAt": "20:00", "title": "광안리 저녁식사·야경", "type": "food" },
  { "id": "paradise-return", "time": "20:00", "startAt": "20:00", "endAt": "20:30", "title": "파라다이스호텔 부산 복귀", "type": "transport" }
]
```

Set both `routeSequences["2026-08-18"]` and
`mapRoutePoints["18일"]` to the order asserted in Task 1. Use these
coordinates: Paradise `35.1605,129.1635`, X the Sky `35.1598,129.1707`,
Museum 1 `35.1686,129.1303`, Cinema Center `35.1710,129.1288`,
F1963 `35.1660,129.1156`, and Gwangalli `35.1532,129.1187`.

- [ ] **Step 2: Add optional experiences and fallbacks**

Add this top-level option contract:

```json
"optionalExperiences": {
  "2026-08-18": [
    {
      "id": "suyeong-yacht",
      "title": "수영만 요트 체험",
      "area": "수영만 요트경기장",
      "durationMinutes": 60,
      "replaces": ["cinema-center", "f1963"],
      "costPolicy": "예약 시점의 성수기·시간대·인원별 요금 확인",
      "conditions": "비, 강풍, 해상 상태와 선장 판단에 따라 취소 또는 일정 변경 가능",
      "sourceUrl": "https://www.visitbusan.net/index.do?lang_cd=en&menuCd=DOM_000000304004001000&uc_seq=1775"
    },
    {
      "id": "centum-ice-rink",
      "title": "신세계 센텀 아이스링크",
      "area": "센텀시티",
      "durationMinutes": 120,
      "replaces": ["cinema-center", "f1963"],
      "costPolicy": "현장 또는 예약 화면의 당일 요금 확인",
      "conditions": "운영시간, 회차, 장갑·양말·보호장비 조건을 당일 확인",
      "sourceUrl": "https://www.shinsegae.com/department/store/centum/ice-rink"
    }
  ]
}
```

Create `mealFallbacks` from the Candidate Dossier. Each entry has this exact
shape:

```json
{
  "name": "Korean place name",
  "genre": "cuisine type",
  "area": "scheduled route area",
  "meal": "breakfast",
  "url": "https://map.naver.com/p/search/encoded-place-name",
  "note": "The immediately preceding or following route block it fits.",
  "waitRisk": "check-wait"
}
```

Retain `mealSlots`, `mealSelections`, and `mealPriorities` for selected
foods. Replace only the 19 August `dinner` key with `takeaway` in all three
of those structures. Remove every day-18 budget route/block override so all
modes inherit the confirmed sequence. Add this row to each budget's items:

```json
{ "label": "선택 체험", "amount": "예약 시 확인", "detail": "수영만 요트 또는 센텀 아이스링크는 기본 예산에 포함하지 않음" }
```

- [ ] **Step 3: Run green data tests**

```powershell
node docs/qa-server.test.js
node --test docs/assets/js/trip-agents.test.js
node -e "JSON.parse(require('fs').readFileSync('docs/assets/data/busan-family-trip-2026.json','utf8')); console.log('json ok')"
```

Expected: both test commands pass and the parse command prints `json ok`.

- [ ] **Step 4: Commit data**

```powershell
git add docs/assets/data/busan-family-trip-2026.json docs/qa-server.test.js docs/assets/js/trip-agents.test.js
git commit -m "feat: replace osiria with centum meal fallbacks"
```

### Task 3: Preserve the Base Route and Expose Options

**Files:**
- Modify: `docs/assets/js/trip-agents.js`
- Modify: `docs/assets/js/trip-agents.test.js`

- [ ] **Step 1: Generalize protected routes**

Add near `routeAgent`:

```js
const REQUIRED_ROUTE_STOPS = {
  "2026-08-17": ["SK렌터카 부산역지점", "해동용궁사", "미포주차장", "청사포", "해운대 렌터카 반납"],
  "2026-08-18": ["파라다이스호텔 부산", "부산엑스더스카이", "뮤지엄원", "부산영화의전당", "F1963", "광안리"]
};

function selectRouteSequence(date, budgetSequence, confirmedSequence) {
  const requiredStops = REQUIRED_ROUTE_STOPS[date] || [];
  const budgetHasCore = requiredStops.every((stop) => budgetSequence?.includes(stop));
  const confirmedHasCore = requiredStops.every((stop) => confirmedSequence.includes(stop));
  return budgetSequence && (!confirmedHasCore || budgetHasCore) ? budgetSequence : confirmedSequence;
}
```

Replace the day-17-specific selection with
`selectRouteSequence(day.date, budgetSequence, confirmedSequence)`.

- [ ] **Step 2: Emit separate food fallbacks and activity options**

Add:

```js
function mealLabel(meal) {
  return { breakfast: "아침", lunch: "점심", dinner: "저녁", takeaway: "KTX 탑승 전 포장" }[meal] || meal;
}
```

In `foodAgent`, return fallback groups separately from selected slots:

```js
const fallbacks = Object.entries(context.mealFallbacks?.[day.date] || {}).map(([meal, candidates]) => ({
  meal,
  label: mealLabel(meal),
  selected: slots.find((slot) => slot.meal === meal)?.primary || null,
  candidates
}));
return { ...day, slots, fallbacks };
```

In `activityAgent`, include
`options: context.optionalExperiences?.[day.date] || []` beside `chosen`.
Change its constraint to the approved Centum-Suyeong-Gwangalli rule. Do not add
options to blocks or map routes.

- [ ] **Step 3: Validate data without modifying the itinerary**

At the start of `validate`, add:

```js
const removedTerms = ["오시리아", "국립부산과학관", "스카이라인 루지", "롯데월드"];
if (removedTerms.some((term) => JSON.stringify(context).includes(term))) {
  warnings.push("18일 확정안에서 제외한 오시리아 권역 정보가 남아 있습니다.");
}
```

In `validateMealAndRequests`, warn if a fallback group does not have exactly
five unique HTTPS entries or an option's two `replaces` IDs are not present in
that day's blocks. Warnings must not delete a fixed block.

- [ ] **Step 4: Verify and commit**

```powershell
node --test docs/assets/js/trip-agents.test.js
node docs/qa-server.test.js
git add docs/assets/js/trip-agents.js docs/assets/js/trip-agents.test.js docs/qa-server.test.js
git commit -m "feat: validate centum options and meal fallbacks"
```

Expected: both tests pass before the commit.

### Task 4: Render Options and Expanded Existing Food Panel

**Files:**
- Modify: `docs/assets/js/app.js`
- Modify: `docs/assets/css/styles.css`
- Modify: `docs/assets/css/styles.test.js`
- Modify: `docs/qa-server.test.js`

- [ ] **Step 1: Add failing static UI checks**

```js
function testAppRendersSeparateOptionsAndMealFallbacks() {
  assert.match(appSource, /function renderOptionalExperiences/);
  assert.match(appSource, /day\.activities\.options/);
  assert.match(appSource, /day\.meals\.fallbacks/);
  assert.match(appSource, /KTX 탑승 전 포장/);
  assert.match(appSource, /safeExternalUrl\(candidate\.url\)/);
  assert.match(appSource, /선택 체험/);
}
```

Add to `styles.test.js`:

```js
assert.match(css, /\.optional-experience-list\{[^}]*display:grid/);
assert.match(css, /\.meal-fallback-list\{[^}]*display:grid/);
assert.match(css, /\.meal-fallback-link\{[^}]*color:var\(--sea\)/);
assert.match(css, /@media\(max-width:760px\)\{\.meal-fallback-list\{/);
```

- [ ] **Step 2: Run red UI checks**

```powershell
node docs/qa-server.test.js
node docs/assets/css/styles.test.js
```

Expected: the new assertions fail before rendering code exists.

- [ ] **Step 3: Implement UI rendering with the existing sanitizer**

Add before `renderItinerary`:

```js
function renderOptionalExperiences(day) {
  const options = day.activities.options || [];
  if (!options.length) return "";
  return "<section class=\"optional-experience-list\"><h4>당일 선택 체험</h4>" + options.map((option) =>
    "<article class=\"optional-experience\"><strong>" + escapeHtml(option.title) + "</strong>" +
    "<p>" + escapeHtml(option.area) + " · 약 " + escapeHtml(String(option.durationMinutes)) + "분</p>" +
    "<small>기본 일정에서 " + escapeHtml(option.replaces.join(" · ")) + " 구간을 대체</small>" +
    "<small>" + escapeHtml(option.conditions) + "</small><small>" + escapeHtml(option.costPolicy) + "</small>" +
    "<a href=\"" + escapeHtml(safeExternalUrl(option.sourceUrl)) + "\" target=\"_blank\" rel=\"noopener noreferrer\">운영 정보 확인 -></a></article>"
  ).join("") + "</section>";
}
```

Append `renderOptionalExperiences(day)` after base blocks. In `renderFood`,
keep the selected-food cards, then append one fallback card per
`day.meals.fallbacks`. Each candidate link must use
`safeExternalUrl(candidate.url)`, show name, genre, `waitRisk`, and note.
Do not create a navigation tab or mutate `mealSelections`.

Add responsive classes `.optional-experience-list`,
`.optional-experience`, `.meal-fallback-list`, and
`.meal-fallback-link` using existing `--sea`, `--line`, `--card`, and
the current 760px breakpoint.

- [ ] **Step 4: Verify and commit**

```powershell
node docs/qa-server.test.js
node docs/assets/css/styles.test.js
node --check docs/assets/js/app.js
git add docs/assets/js/app.js docs/assets/css/styles.css docs/assets/css/styles.test.js docs/qa-server.test.js
git commit -m "feat: render optional activities and meal fallbacks"
```

Expected: all commands exit 0 before the commit.

### Task 5: Complete Regression and Deployment Readiness

**Files:**
- Modify: `docs/qa-server.test.js` only if manual verification reveals an uncovered contract.

- [ ] **Step 1: Run complete static regression**

```powershell
node --test docs/assets/js/trip-agents.test.js
node docs/qa-server.test.js
node docs/assets/css/styles.test.js
node --check docs/assets/js/app.js
node --check docs/assets/js/trip-agents.js
node -e "JSON.parse(require('fs').readFileSync('docs/assets/data/busan-family-trip-2026.json','utf8')); console.log('json ok')"
```

Expected: every command exits 0 and the final command prints `json ok`.

- [ ] **Step 2: Perform browser smoke verification**

Start `node docs/qa-server.js`, then inspect desktop, tablet, and mobile widths.
For each budget mode, press `전체 일정 재계산`. Confirm the day-18 itinerary
and map keep the order Paradise -> X the Sky -> Museum 1 -> Cinema Center ->
F1963 -> Gwangalli -> Paradise; yacht and rink are option cards only; every
meal group shows the selected choice plus five fallbacks; and the 19 August
final group says `KTX 탑승 전 포장`.

- [ ] **Step 3: Commit only a needed regression and publish**

If Step 2 exposes a gap, add the smallest matching `qa-server.test.js`
assertion, rerun Step 1, and commit it:

```powershell
git add docs/qa-server.test.js
git commit -m "test: guard centum meal fallback regression"
```

Then publish only after every check passes:

```powershell
git status -sb
git push origin main
```

Expected: no uncommitted changes before the push, followed by a successful push
to `origin/main`. Verify GitHub Pages succeeds before reporting the public
page update.

