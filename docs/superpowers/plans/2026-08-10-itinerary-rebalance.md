# 부산 기준 일정 재조율 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 새 부산 권역별 기준안과 식사·짐·KTX 제약을 모든 전문 에이전트와 총괄 검수 결과에 일관되게 반영한다.

**Architecture:** 여행 사실과 식사 후보는 JSON의 정규화된 일자·끼니 데이터로 관리한다. `trip-agents.js`는 이를 순수한 전문 에이전트 출력으로 조합하고, 총괄 검증 함수가 교차 제약을 검사한다. `app.js`는 그 결과를 기존 일정·탐색·식사·운영 탭에 표시한다.

**Tech Stack:** 정적 GitHub Pages, Vanilla JavaScript, Node.js built-in test runner, Leaflet, JSON.

---

## File Structure

- Modify: `docs/assets/data/busan-family-trip-2026.json` - 일자별 블록, 지도 좌표, 끼니·지점 메타데이터.
- Modify: `docs/assets/js/trip-agents.js` - 전문 에이전트 출력과 총괄 검수 규칙.
- Modify: `docs/assets/js/trip-agents.test.js` - 새 일정·식당·예산 회귀 테스트.
- Modify: `docs/assets/js/app.js` - 끼니별 식당 후보와 부산역 짐 보관 렌더링.
- Modify: `docs/qa-server.test.js` - 정적 화면의 새 데이터 계약 검증.

### Task 1: 기준 일정과 식사 후보 데이터를 정규화한다

**Files:**
- Modify: `docs/assets/data/busan-family-trip-2026.json`
- Modify: `docs/assets/js/trip-agents.test.js`

- [ ] **Step 1: 새 기준안에 대한 실패 테스트를 쓴다**

```js
test("rebalanced flow keeps Cimer on day 17 and station storage on day 19", () => {
  const result = runTripOrchestrator(rebalancedContext);
  const day17 = result.days.find((day) => day.date === "2026-08-17");
  const day19 = result.days.find((day) => day.date === "2026-08-19");
  assert.equal(day17.blocks.some((block) => block.title.includes("씨메르")), true);
  assert.equal(day19.blocks.some((block) => block.title.includes("씨메르")), false);
  assert.equal(result.specialistOutputs.lodging.recommendations.at(-1).luggage.includes("부산역"), true);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test docs/assets/js/trip-agents.test.js`

Expected: FAIL because the current data and lodging output still put 씨메르 on 19일.

- [ ] **Step 3: 네 날짜의 JSON 블록과 경로를 교체한다**

16일은 `부산역 → 초량 → 남포·자갈치 → 영도 → 아스티호텔`로, 영도 후보는 흰여울문화마을(`clear`)과 국립해양박물관(`rain`)으로 저장한다. 17일은 체크아웃·파라다이스호텔 짐 전달·미포·청사포·해운대·오션풀 또는 씨메르로, 18일은 오시리아와 날씨별 체험으로, 19일은 아래와 같이 저장한다.

```json
[
  { "time": "11:00", "title": "파라다이스호텔 체크아웃", "type": "lodging" },
  { "time": "11:20", "title": "택시로 부산역 이동·역내 짐 보관", "type": "transport" },
  { "time": "12:20", "title": "부산역 인근 점심·짧은 휴식", "type": "food" },
  { "time": "13:45", "title": "승강장 이동·KTX 탑승 준비", "type": "transport" },
  { "time": "14:31", "title": "부산역 KTX 출발", "type": "fixed" }
]
```

19일 `routeSequences`와 `mapRoutePoints`에는 파라다이스호텔과 부산역만 남긴다.

- [ ] **Step 4: 끼니 단위 식당 데이터를 추가한다**

`mealSlots[date]`에 `lunch`, `dinner`를 만들고, 각 끼니에 서로 다른 장르의 후보를 세 곳 이상 넣는다. 후보 형태는 아래로 고정한다.

```json
{ "name": "해운대암소갈비집", "genre": "한우 갈비", "area": "해운대", "meal": "dinner", "url": "https://naver.me/5LHsNhM3", "note": "대기·예약 정책은 출발 전 재확인" }
```

17일 점심에 해운대가야밀면, 17일 저녁에 해운대암소갈비집·맛찬들왕소금구이 부산해운대점·해운대다찌·이카를 넣는다. 18일 남천·광안리 저녁 선택지에는 안목 남천동 지점을, 19일 부산역 점심에는 안목 부산역점 등 역권 후보를 넣는다.

- [ ] **Step 5: 데이터 기반 테스트를 통과시킨다**

Run: `node --test docs/assets/js/trip-agents.test.js`

Expected: data assertion passes; later contract assertions may still fail until Task 2.

- [ ] **Step 6: 커밋한다**

```bash
git add docs/assets/data/busan-family-trip-2026.json docs/assets/js/trip-agents.test.js
git commit -m "data: rebalance Busan travel itinerary"
```

### Task 2: 전문 에이전트와 총괄 검수를 갱신한다

**Files:**
- Modify: `docs/assets/js/trip-agents.js`
- Modify: `docs/assets/js/trip-agents.test.js`

- [ ] **Step 1: 에이전트 계약에 대한 실패 테스트를 쓴다**

```js
test("food agent returns three genre-distinct candidates for every meal slot", () => {
  const result = runTripOrchestrator(rebalancedContext);
  for (const day of result.specialistOutputs.food.recommendations) {
    for (const slot of day.slots) {
      assert.ok(slot.candidates.length >= 3);
      assert.equal(new Set(slot.candidates.map((item) => item.genre)).size, slot.candidates.length);
    }
  }
});

test("manager warns when day 19 contains Cimer", () => {
  const changed = addDay19Cimer(rebalancedContext);
  const result = runTripOrchestrator(changed);
  assert.equal(result.warnings.some((warning) => warning.includes("19일") && warning.includes("씨메르")), true);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test docs/assets/js/trip-agents.test.js`

Expected: FAIL because `foodAgent` returns a flat string array and `validate` requires 씨메르 on 19일.

- [ ] **Step 3: 식당 에이전트의 슬롯 반환을 구현한다**

`foodAgent`가 `context.mealSlots[date]`에서 다음 결과를 만든다. `meals`는 일정 요약을 위한 파생 배열이며, 예산 타입은 세 후보 아래로 식당 수를 줄이지 않는다.

```js
{
  date,
  slots: [
    { meal: "lunch", candidates: [{ name, genre, area, meal, url, note }] },
    { meal: "dinner", candidates: [{ name, genre, area, meal, url, note }] }
  ],
  meals: slots.flatMap((slot) => slot.candidates.map((item) => item.name))
}
```

- [ ] **Step 4: 숙소·교통·총괄 검수 규칙을 구현한다**

`lodgingAgent`의 파라다이스호텔 출력은 `19일 11:00 체크아웃 후 짐을 들고 부산역으로 이동해 역내 물품보관함 또는 짐보관 서비스 이용`을 반환한다. `transportAgent`는 `stationArrivalTarget: "11:55~12:15"`, `boardingBuffer: "13:45"`를 반환한다.

`validate`는 17일 해운대·물놀이 누락, 18일 해운대 반복·우천 대체 누락, 19일 씨메르 잔존·부산역 짐 보관 누락·13:45 이후 승강장 이동, 끼니별 세 후보·세 장르 미만, 예산 타입 불일치를 경고한다. 기존의 `19일 씨메르 누락` 검사는 제거한다.

- [ ] **Step 5: 테스트를 통과시킨다**

Run: `node --test docs/assets/js/trip-agents.test.js`

Expected: PASS with all existing and new tests.

- [ ] **Step 6: 커밋한다**

```bash
git add docs/assets/js/trip-agents.js docs/assets/js/trip-agents.test.js
git commit -m "feat: validate rebalanced trip agents"
```

### Task 3: 모든 탭에 슬롯·짐 보관 결과를 렌더링한다

**Files:**
- Modify: `docs/assets/js/app.js`
- Modify: `docs/qa-server.test.js`

- [ ] **Step 1: 새 화면 계약의 실패 검증을 쓴다**

```js
assert.match(appScript, /day\.meals\.slots/);
assert.match(appScript, /candidate\.genre/);
assert.match(appScript, /candidate\.url/);
assert.match(appScript, /stationArrivalTarget/);
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test docs/qa-server.test.js`

Expected: FAIL because the current renderer consumes only `day.meals.meals`.

- [ ] **Step 3: 일정·식사·운영 렌더러를 바꾼다**

`renderFood`는 날짜·점심/저녁별 섹션을 그리고 각 후보의 장르, 권역, 메모, 안전한 HTTPS 지도 링크를 표시한다. `renderItinerary`는 슬롯마다 첫 후보 이름과 장르만 요약한다. `renderOps`는 하드코딩된 씨메르 귀환 문구를 제거하고, 총괄 결과의 부산역 짐 보관·목표 도착·13:45 승강장 버퍼를 보여 준다.

```js
day.meals.slots.map((slot) => slot.candidates.map((candidate) =>
  `<article class="food-card"><span class="tag">${escapeHtml(candidate.genre)} · ${escapeHtml(candidate.area)}</span><h4>${escapeHtml(candidate.name)}</h4><p>${escapeHtml(candidate.note)}</p><a href="${escapeHtml(safeExternalUrl(candidate.url))}" target="_blank" rel="noopener noreferrer">지도 확인</a></article>`
))
```

- [ ] **Step 4: 지도 데이터 계약을 확인한다**

`orchestratedMapRoutes`는 계속 에이전트 경로를 사용한다. 데이터 키를 맞춰 19일에 파라다이스호텔 → 부산역 핀과 선만, 17일에 해운대 경로만 순서대로 표시되게 한다.

- [ ] **Step 5: 화면 QA 테스트를 통과시킨다**

Run: `node --test docs/qa-server.test.js`

Expected: PASS.

- [ ] **Step 6: 커밋한다**

```bash
git add docs/assets/js/app.js docs/qa-server.test.js
git commit -m "feat: render rebalanced meal and return guidance"
```

### Task 4: 전체 일정 재계산과 예산 모드를 검증한다

**Files:**
- Modify: `docs/assets/js/trip-agents.test.js`
- Modify: `docs/qa-server.test.js`

- [ ] **Step 1: 예산 회귀 실패 테스트를 쓴다**

```js
test("all budget modes preserve return KTX and meal-slot constraints", () => {
  for (const budgetMode of ["light", "balanced", "comfort"]) {
    const result = runTripOrchestrator({ ...rebalancedContext, budgetMode });
    assert.equal(result.specialistOutputs.transport.recommendations[2].detail.includes("14:31"), true);
    assert.equal(result.days[3].blocks.some((block) => block.title.includes("씨메르")), false);
    assert.ok(result.days.every((day) => day.meals.slots.every((slot) => slot.candidates.length >= 3)));
  }
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test docs/assets/js/trip-agents.test.js docs/qa-server.test.js`

Expected: FAIL until every budget plan preserves compatible meal-slot output.

- [ ] **Step 3: 최소 보완 후 자동 검증을 실행한다**

Run: `node --test docs/assets/js/trip-agents.test.js docs/assets/css/styles.test.js docs/qa-server.test.js`

Expected: PASS with zero failures.

Run: `node docs/qa-server.js`

Expected: static server starts. In the browser, click 전체 일정 재계산, switch 알뜰·균형·여유, and select each map date; verify the new 16~19일 blocks, meal slots, and ordered route lines.

- [ ] **Step 4: 최종 커밋한다**

```bash
git add docs/assets/data/busan-family-trip-2026.json docs/assets/js/trip-agents.js docs/assets/js/trip-agents.test.js docs/assets/js/app.js docs/qa-server.test.js
git commit -m "test: cover revised Busan trip recalculation"
```

## Plan Self-Review

- Spec coverage: Task 1 updates each date, map and restaurants; Task 2 updates all specialist and total-manager contracts; Task 3 connects every existing tab; Task 4 covers recalculation, all budgets and static delivery.
- Placeholder scan: 구현을 미루는 표기나 비어 있는 테스트 단계가 없다.
- Contract consistency: `foodAgent` returns `slots` plus a derived `meals` array; renderers and tests use those fields. `stationArrivalTarget` and `boardingBuffer` originate with transport and are consumed by operations rendering.
