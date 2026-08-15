const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { runTripOrchestrator } = require("./trip-agents.js");

const itineraryFixture = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/busan-family-trip-2026.json"), "utf8"));

const context = {
  fixedTransport: { outbound: { departAt: "07:58", arriveAt: "10:46" }, return: { departAt: "14:31", arriveAtStation: "14:00" } },
  lodgings: [{ name: "아스티호텔 부산", checkInDate: "2026-08-16", checkOutDate: "2026-08-17" }, { name: "파라다이스호텔 부산", checkInDate: "2026-08-17", checkOutDate: "2026-08-19" }],
  dayFlows: [{ date: "2026-08-16", intent: "부산역과 영도" }, { date: "2026-08-17", intent: "해운대 관광과 물놀이" }, { date: "2026-08-18", intent: "오시리아 체험" }, { date: "2026-08-19", intent: "씨메르 후 귀환" }],
  defaultBlocks: { "2026-08-17": [{ title: "파라다이스호텔 물놀이", type: "water" }] },
  routeHubs: { "2026-08-16": "부산역·영도", "2026-08-17": "해운대", "2026-08-18": "오시리아", "2026-08-19": "해운대·부산역" },
  routeSequences: {}, mealCandidates: {}, videoSources: [],
  activityCandidates: { "2026-08-17": [{ title: "해운대해수욕장", area: "해운대", audience: ["12살"] }], "2026-08-18": [{ title: "롯데월드 부산", area: "오시리아", audience: ["12살"], weather: "clear" }, { title: "국립부산과학관", area: "오시리아", audience: ["12살"], weather: "rain" }] }
};

test("manager places water play on day 17 and Osiria activities on day 18", () => {
  const result = runTripOrchestrator(context);
  assert.equal(result.days[1].route.hub, "해운대");
  assert.equal(result.days[2].route.hub, "오시리아");
  assert.equal(result.days[2].activities.chosen[0].title, "롯데월드 부산");
});

test("manager preserves return train with the Busan Station buffer", () => {
  const changed = { ...context, dayFlows: context.dayFlows.map((day) => day.date === "2026-08-19" ? { ...day, intent: "아침 식사 후 귀환" } : day) };
  const result = runTripOrchestrator(changed);
  assert.equal(result.specialistOutputs.transport.recommendations[2].detail.includes("14:31"), true);
  assert.equal(result.specialistOutputs.transport.recommendations[2].detail.includes("11:55~12:15"), true);
  assert.equal(result.warnings.some((warning) => warning.includes("씨메르")), false);
});

test("manager changes a non-confirmed route when the user requests Gwangalli and Centum", () => {
  const changed = { ...context, dayFlows: context.dayFlows.map((day) => day.date === "2026-08-16" ? { ...day, intent: "광안리 요트와 센텀 휴식" } : day), activityCandidates: { ...context.activityCandidates, "2026-08-16": [{ title: "광안리 요트", area: "광안리", audience: ["12살"] }, { title: "센텀 스파랜드", area: "센텀", audience: ["가족"] }] } };
  const result = runTripOrchestrator(changed);
  assert.equal(result.days[0].route.hub, "광안리·센텀");
  assert.deepEqual(result.days[0].route.sequence, ["파라다이스호텔", "센텀", "광안리"]);
});

test("budget mode removes paid blocks and adds a free alternative across the plan", () => {
  const changed = { ...context, budgetMode: "light", budgetPlans: { light: { mealLimit: 2, removeKeywords: { "2026-08-17": ["블루라인파크"] }, addBlocks: { "2026-08-17": [{ time: "낮", title: "해운대해수욕장 산책·무료 물놀이", type: "free" }] }, routes: { "2026-08-17": ["파라다이스호텔", "해운대해수욕장", "동백섬"] }, activities: { "2026-08-17": ["파라다이스호텔 물놀이"] } } } };
  const result = runTripOrchestrator(changed);
  assert.equal(result.days[1].blocks.some((block) => block.title.includes("블루라인파크")), false);
  assert.equal(result.days[1].blocks.some((block) => block.title.includes("무료 물놀이")), true);
  assert.deepEqual(result.days[1].route.sequence, ["파라다이스호텔", "해운대해수욕장", "동백섬"]);
});

test("light budget keeps schedule, route, food, and activity outputs aligned", () => {
  const changed = {
    ...context,
    budgetMode: "light",
    budgetPlans: {
      light: {
        mealLimit: 2,
        removeKeywords: { "2026-08-18": ["\uB86F\uB370\uC6D4\uB4DC \uBD80\uC0B0", "\uC2A4\uCE74\uC774\uB77C\uC778 \uB8E8\uC9C0"] },
        addBlocks: { "2026-08-18": [{ title: "\uAD11\uC548\uB9AC \uC0B0\uCC45\u00B7\uBBFC\uB77D\uC218\uBCC0 \uD734\uC2DD", type: "free" }] },
        routes: { "2026-08-18": ["\uD30C\uB77C\uB2E4\uC774\uC2A4\uD638\uD154", "\uAD11\uC548\uB9AC"] },
        meals: { "2026-08-18": ["\uAD11\uC548\uB9AC \uBD84\uC2DD\u00B7\uAC04\uC2DD", "\uBBFC\uB77D\uC218\uBCC0 \uD3EC\uC7A5 \uC2DD\uC0AC"] },
        activities: { "2026-08-18": ["\uAD11\uC548\uB9AC \uC0B0\uCC45\u00B7\uBBFC\uB77D\uC218\uBCC0 \uD734\uC2DD"] }
      }
    },
    activityCandidates: { ...context.activityCandidates, "2026-08-18": [{ title: "\uAD11\uC548\uB9AC \uC0B0\uCC45\u00B7\uBBFC\uB77D\uC218\uBCC0 \uD734\uC2DD", area: "\uAD11\uC548\uB9AC", audience: ["12\uC0B4", "\uAC00\uC871"], weather: "clear" }] }
  };
  const result = runTripOrchestrator(changed);
  const day18 = result.days[2];
  assert.equal(day18.blocks.some((block) => block.title.includes("\uB86F\uB370\uC6D4\uB4DC")), false);
  assert.equal(day18.blocks.some((block) => block.title.includes("\uC2A4\uCE74\uC774\uB77C\uC778")), false);
  assert.equal(day18.blocks.some((block) => block.title.includes("\uAD11\uC548\uB9AC \uC0B0\uCC45")), true);
  assert.deepEqual(day18.route.sequence, ["\uD30C\uB77C\uB2E4\uC774\uC2A4\uD638\uD154", "\uAD11\uC548\uB9AC"]);
  assert.deepEqual(day18.meals.meals, ["\uAD11\uC548\uB9AC \uBD84\uC2DD\u00B7\uAC04\uC2DD", "\uBBFC\uB77D\uC218\uBCC0 \uD3EC\uC7A5 \uC2DD\uC0AC"]);
  assert.equal(day18.activities.chosen[0].title, "\uAD11\uC548\uB9AC \uC0B0\uCC45\u00B7\uBBFC\uB77D\uC218\uBCC0 \uD734\uC2DD");
});

test("known 송도 and 감천 input propagates to every specialist output", () => {
  const changed = {
    ...context,
    dayFlows: context.dayFlows.map((day) => day.date === "2026-08-16" ? { ...day, intent: "\uC1A1\uB3C4 \uCF00\uC774\uBE14\uCE74\uC640 \uAC10\uCC9C\uBB38\uD654\uB9C8\uC744" } : day),
    defaultBlocks: { ...context.defaultBlocks, "2026-08-16": [{ title: "\uC2A4\uCE74\uC774\uB77C\uC778 \uB8E8\uC9C0", type: "paid" }] },
    mealCandidates: { ...context.mealCandidates, "2026-08-16": ["\uC624\uC2DC\uB9AC\uC544 \uC2DD\uB2F9\uAC00"] },
    activityCandidates: { ...context.activityCandidates, "2026-08-16": [{ title: "\uAD11\uC548\uB9AC \uC0B0\uCC45\u00B7\uBBFC\uB77D\uC218\uBCC0 \uD734\uC2DD", area: "\uAD11\uC548\uB9AC", audience: ["12\uC0B4", "\uAC00\uC871"], weather: "clear" }] }
  };
  const result = runTripOrchestrator(changed);
  const day16 = result.days[0];
  assert.equal(day16.route.hub, "\uC1A1\uB3C4\u00B7\uAC10\uCC9C");
  assert.deepEqual(day16.route.sequence, ["\uD30C\uB77C\uB2E4\uC774\uC2A4\uD638\uD154", "\uAC10\uCC9C\uBB38\uD654\uB9C8\uC744", "\uC1A1\uB3C4 \uCF00\uC774\uBE14\uCE74"]);
  assert.equal(day16.blocks.some((block) => block.title === "\uAC10\uCC9C\uBB38\uD654\uB9C8\uC744"), true);
  assert.equal(day16.meals.meals[0], "\uC1A1\uB3C4 \uD574\uC0B0\uBB3C");
  assert.equal(day16.activities.chosen.some((item) => item.title === "\uC1A1\uB3C4 \uCF00\uC774\uBE14\uCE74"), true);
});

test("custom destination overrides paid additions from the previous region", () => {
  const changed = {
    ...context,
    budgetMode: "comfort",
    budgetPlans: { comfort: { addBlocks: { "2026-08-16": [{ title: "\uC2A4\uCE74\uC774\uB77C\uC778 \uB8E8\uC9C0\u00B7\uC624\uC2DC\uB9AC\uC544 \uD0DD\uC2DC \uC774\uB3D9", type: "activity" }] }, routes: {}, activities: {} } },
    dayFlows: context.dayFlows.map((day) => day.date === "2026-08-16" ? { ...day, intent: "\uC1A1\uB3C4 \uCF00\uC774\uBE14\uCE74\uC640 \uAC10\uCC9C\uBB38\uD654\uB9C8\uC744" } : day)
  };
  const result = runTripOrchestrator(changed);
  assert.equal(result.days[0].blocks.some((block) => block.title.includes("\uC2A4\uCE74\uC774\uB77C\uC778")), false);
  assert.equal(result.days[0].route.sequence.includes("\uC1A1\uB3C4 \uCF00\uC774\uBE14\uCE74"), true);
});

test("unknown budget mode falls back to balanced behavior", () => {
  const changed = { ...context, budgetMode: "unknown", budgetPlans: { balanced: { mealLimit: 3, routes: {}, removeKeywords: {}, addBlocks: {}, activities: {} } } };
  const result = runTripOrchestrator(changed);
  assert.equal(result.days[2].route.hub, context.routeHubs["2026-08-18"]);
  assert.deepEqual(result.days[2].meals.meals, []);
});

test("food agent retains every route-matched food candidate while keeping the itinerary meal limit", () => {
  const candidates = [
    { name: "초량밀면", area: "초량", routeStatus: "동선 일치" },
    { name: "만리향", area: "중앙동", routeStatus: "동선 일치" },
    { name: "영도 해산물", area: "영도", routeStatus: "동선 일치" },
    { name: "남포 분식", area: "남포", routeStatus: "동선 일치" }
  ];
  const changed = {
    ...context,
    budgetMode: "balanced",
    budgetPlans: { balanced: { mealLimit: 3, routes: {}, removeKeywords: {}, addBlocks: {}, activities: {} } },
    mealCandidates: { ...context.mealCandidates, "2026-08-16": candidates.map((candidate) => candidate.name) },
    foodCandidates: { "2026-08-16": candidates }
  };

  const day16 = runTripOrchestrator(changed).days[0];

  assert.deepEqual(day16.meals.meals, ["초량밀면", "만리향", "영도 해산물"]);
  assert.deepEqual(day16.meals.candidates, candidates);
});
test("food agent exposes every meal slot and retains three candidates in light mode", () => {
  const result = runTripOrchestrator({ ...itineraryFixture, budgetMode: "light" });

  for (const day of result.specialistOutputs.food.recommendations) {
    assert.deepEqual(day.slots.map((slot) => slot.meal), Object.keys(itineraryFixture.mealSlots[day.date]));
    for (const slot of day.slots) {
      assert.ok(slot.candidates.length >= 3, `${day.date} ${slot.meal} keeps three candidates`);
    }
    assert.ok(day.meals.length >= 2, `${day.date} has concise meal summaries`);
  }

  const day17 = result.days.find((day) => day.date === "2026-08-17");
  assert.equal(day17.meals.slots.find((slot) => slot.meal === "lunch").candidates.some((candidate) => candidate.name === "해운대가야밀면"), true);
});

test("day 19 agents retain Zim Carry logistics and the return KTX buffer", () => {
  const result = runTripOrchestrator(itineraryFixture);
  const returnTrip = result.specialistOutputs.transport.recommendations.find((item) => item.date === "2026-08-19");

  assert.match(returnTrip.detail, /짐캐리/);
  assert.match(returnTrip.detail, /짐캐리.*호텔 인계/);
  assert.match(returnTrip.detail, /부산역.*수령/);
  assert.doesNotMatch(returnTrip.detail, /역내 짐 보관|부산역 짐 보관/);
  assert.match(returnTrip.detail, /13:45/);
  assert.match(returnTrip.detail, /14:31/);
  assert.doesNotMatch(returnTrip.detail, /씨메르/);
  assert.equal(returnTrip.logistics.url, itineraryFixture.luggageTransfer.url);
  assert.equal(result.warnings.some((warning) => warning.includes("해운대")), false);
});

test("manager warns when the day 19 return KTX is not scheduled for 14:31", () => {
  const changed = {
    ...itineraryFixture,
    fixedTransport: {
      ...itineraryFixture.fixedTransport,
      return: { ...itineraryFixture.fixedTransport.return, departAt: "15:00" }
    }
  };

  const result = runTripOrchestrator(changed);

  assert.equal(result.warnings.some((warning) => warning.includes("14:31")), true);
});

test("rebalanced fixture keeps the confirmed day 17 and day 19 routes", () => {
  const result = runTripOrchestrator(itineraryFixture);
  const day17 = result.days.find((day) => day.date === "2026-08-17");
  const day19 = result.days.find((day) => day.date === "2026-08-19");

  assert.deepEqual(day17.route.sequence, itineraryFixture.routeSequences["2026-08-17"]);
  assert.deepEqual(day19.route.sequence, itineraryFixture.routeSequences["2026-08-19"]);
});

test("rebalanced fixture provides distinct meal options for every day", () => {
  for (const date of ["2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19"]) {
    for (const [meal, candidates] of Object.entries(itineraryFixture.mealSlots?.[date] || {})) {
      assert.ok(candidates.length >= 3, `${date} ${meal} needs three candidates`);
      assert.equal(new Set(candidates.map((candidate) => candidate.genre)).size, candidates.length);
      for (const candidate of candidates) {
        assert.match(candidate.url, /^https:\/\//);
      }
    }
  }
});

test("rebalanced fixture retains the required weather, hotel, and KTX itinerary details", () => {
  const blocksFor = (date) => itineraryFixture.defaultBlocks[date];
  const hasBlock = (date, text) => blocksFor(date).some((block) => block.title.includes(text));
  const activitiesFor = (date) => itineraryFixture.activityCandidates[date];

  assert.equal(hasBlock("2026-08-17", "SK\uB80C\uD130\uCE74 \uBD80\uC0B0\uC5ED\uC9C0\uC810 \uB80C\uD130\uCE74 \uC218\uB839"), true);
  assert.equal(hasBlock("2026-08-17", "\uD574\uB3D9\uC6A9\uAD81\uC0AC"), true);
  assert.equal(hasBlock("2026-08-17", "\uBBF8\uD3EC\u00B7\uCCAD\uC0AC\uD3EC \uC655\uBCF5 \uBE14\uB8E8\uB77C\uC778\uD30C\uD06C"), true);

  const day18Activities = activitiesFor("2026-08-18");
  assert.equal(day18Activities.some((activity) => activity.title === "\uBBA4\uC9C0\uC5C4\uC6D0 \uBBF8\uB514\uC5B4\uC544\uD2B8" && activity.weather === "rain"), true);
  assert.equal(day18Activities.some((activity) => activity.title === "\uBD80\uC0B0\uC5D1\uC2A4\uB354\uC2A4\uCE74\uC774" && activity.weather === "clear"), true);

  assert.equal(hasBlock("2026-08-19", "\uD30C\uB77C\uB2E4\uC774\uC2A4\uD638\uD154 \uC9D0\uCE90\uB9AC \uC778\uACC4"), true);
  assert.equal(blocksFor("2026-08-19").some((block) => block.time === "13:45"), true);
  assert.equal(blocksFor("2026-08-19").some((block) => block.time === "14:31" && block.title.includes("KTX")), true);
});

test("rebalanced fixture assigns supplied restaurants to their intended day and meal", () => {
  const candidatesFor = (date, meal) => itineraryFixture.mealSlots[date][meal];
  const hasCandidate = (date, meal, name, area) => candidatesFor(date, meal)
    .some((candidate) => candidate.name === name && candidate.area === area);

  assert.equal(hasCandidate("2026-08-17", "lunch", "\uD574\uC6B4\uB300\uAC00\uC57C\uBC00\uBA74", "\uC88C\uB3D9"), true);
  for (const name of ["\uD574\uC6B4\uB300\uC554\uC18C\uAC08\uBE44\uC9D1", "\uB9DB\uCC2C\uB4E4\uC655\uC18C\uAE08\uAD6C\uC774 \uBD80\uC0B0\uD574\uC6B4\uB300\uC810", "\uD574\uC6B4\uB300\uB2E4\uCC0C", "\uC774\uCE74"]) {
    assert.equal(hasCandidate("2026-08-17", "dinner", name, "\uD574\uC6B4\uB300"), true);
  }
  assert.equal(hasCandidate("2026-08-18", "dinner", "\uAD11\uC548\uB9AC \uC870\uAC1C\uAD6C\uC774", "\uAD11\uC548\uB9AC"), true);
  assert.equal(hasCandidate("2026-08-19", "lunch", "\uD574\uC6B4\uB300 \uB9BD \uBC14\uBE44\uD050 \uB808\uC2A4\uD1A0\uB791", "\uD574\uC6B4\uB300"), true);
});

test("budget modes reorder meal slot candidates without reducing their choices", () => {
  const mealSlot = [
    { name: "\uC54C\uB730 \uC2DD\uB2F9", genre: "\uBD84\uC2DD", area: "\uD574\uC6B4\uB300" },
    { name: "\uADE0\uD615 \uC2DD\uB2F9", genre: "\uD55C\uC2DD", area: "\uD574\uC6B4\uB300" },
    { name: "\uC5EC\uC720 \uC2DD\uB2F9", genre: "\uACE0\uAE30", area: "\uD574\uC6B4\uB300" }
  ];
  const base = {
    ...context,
    mealSlots: { "2026-08-17": { lunch: mealSlot, dinner: mealSlot } },
    budgetPlans: {
      light: { mealPriorities: { "2026-08-17": { lunch: ["\uC54C\uB730 \uC2DD\uB2F9"], dinner: ["\uC54C\uB730 \uC2DD\uB2F9"] } } },
      balanced: { mealPriorities: { "2026-08-17": { lunch: ["\uADE0\uD615 \uC2DD\uB2F9"], dinner: ["\uADE0\uD615 \uC2DD\uB2F9"] } } },
      comfort: { mealPriorities: { "2026-08-17": { lunch: ["\uC5EC\uC720 \uC2DD\uB2F9"], dinner: ["\uC5EC\uC720 \uC2DD\uB2F9"] } } }
    }
  };
  const candidatesFor = (budgetMode) => runTripOrchestrator({ ...base, budgetMode })
    .days.find((day) => day.date === "2026-08-17").meals.slots[0].candidates;

  assert.equal(candidatesFor("light")[0].name, "\uC54C\uB730 \uC2DD\uB2F9");
  assert.equal(candidatesFor("balanced")[0].name, "\uADE0\uD615 \uC2DD\uB2F9");
  assert.equal(candidatesFor("comfort")[0].name, "\uC5EC\uC720 \uC2DD\uB2F9");
  for (const budgetMode of ["light", "balanced", "comfort"]) assert.equal(candidatesFor(budgetMode).length, 3);
});

test("day 18 default route resolves every concrete stop to a map pin", () => {
  const catalog = { ...itineraryFixture.mapPlaceCatalog };
  Object.values(itineraryFixture.mapRoutePoints).flat().forEach((point) => { catalog[point.name] = point; });
  const sequence = itineraryFixture.routeSequences["2026-08-18"];

  assert.equal(sequence.includes("\uBD80\uC0B0\uC5D1\uC2A4\uB354\uC2A4\uCE74\uC774"), true);
  assert.equal(sequence.every((name) => catalog[name]), true);
});

test("day 16 connects lunch, science, both markets, and hotel in order", () => {
  const result = runTripOrchestrator(itineraryFixture);
  const day16 = result.days.find((day) => day.date === "2026-08-16");

  assert.deepEqual(day16.route.sequence, [
    "부산역", "아스티호텔 부산", "이재모피자", "부산과학체험관", "초량전통시장", "부평깡통시장", "아스티호텔 부산"
  ]);
  assert.equal(day16.blocks.some((block) => block.title.includes("이재모피자")), true);
  assert.equal(day16.blocks.some((block) => block.title.includes("부산과학체험관")), true);
  assert.equal(day16.blocks.some((block) => block.title.includes("초량전통시장")), true);
  assert.equal(day16.blocks.some((block) => block.title.includes("부평깡통시장")), true);
});

test("day 16 resolves its market route to the matching map points", () => {
  assert.deepEqual(itineraryFixture.mapRoutePoints["16일"].map((point) => point.name), [
    "부산역", "아스티호텔 부산", "이재모피자", "부산과학체험관", "초량전통시장", "부평깡통시장", "아스티호텔 부산"
  ]);
});

test("day 16 prefers its explicit route sequence over the legacy Nampho profile", () => {
  const legacyDay16Intent = {
    ...itineraryFixture,
    dayFlows: itineraryFixture.dayFlows.map((day) => day.date === "2026-08-16"
      ? { ...day, intent: "부산역·초량·남포·영도" }
      : day)
  };
  const day16 = runTripOrchestrator(legacyDay16Intent).days.find((day) => day.date === "2026-08-16");

  assert.deepEqual(day16.route.sequence, itineraryFixture.routeSequences["2026-08-16"]);
});

test("the fixture no longer exposes Lotte World Busan", () => {
  assert.doesNotMatch(JSON.stringify(itineraryFixture), /롯데월드 부산/);
});

test("day 16 offers Ijaemo Pizza and Bupyeong dinner choices", () => {
  const lunch = itineraryFixture.mealSlots["2026-08-16"].lunch;
  const dinner = itineraryFixture.mealSlots["2026-08-16"].dinner;

  assert.equal(lunch.some((candidate) => candidate.name === "이재모피자"), true);
  for (const name of ["양산집", "깡통골목할매 유부전골", "부평통닭"]) {
    assert.equal(dinner.some((candidate) => candidate.name === name), true);
  }
});

test("day 16 keeps market meal candidates and selections aligned across budget modes", () => {
  const lunch = itineraryFixture.mealSlots["2026-08-16"].lunch;
  const dinner = itineraryFixture.mealSlots["2026-08-16"].dinner;
  const expectedDinnerByMode = {
    light: "\uC591\uC0B0\uC9D1",
    balanced: "\uBD80\uD3C9\uD1B5\uB2ED",
    comfort: "\uBD80\uD3C9\uD1B5\uB2ED"
  };
  const expectedGenres = {
    "\uC591\uC0B0\uC9D1": "\uB3FC\uC9C0\uAD6D\uBC25",
    "\uAE61\uD1B5\uACE8\uBAA9\uD560\uB9E4 \uC720\uBD80\uC804\uACE8": "\uC720\uBD80\uC804\uACE8",
    "\uBD80\uD3C9\uD1B5\uB2ED": "\uD1B5\uB2ED"
  };

  assert.ok(lunch.length >= 3);
  assert.equal(new Set(lunch.map((candidate) => candidate.genre)).size, lunch.length);
  assert.deepEqual(dinner.map((candidate) => candidate.name).sort(), Object.keys(expectedGenres).sort());
  for (const candidate of dinner) {
    assert.equal(candidate.genre, expectedGenres[candidate.name]);
    assert.equal(candidate.area, "\uBD80\uD3C9\uAE61\uD1B5\uC2DC\uC7A5");
    assert.match(candidate.url, /^https:\/\//);
    assert.ok(candidate.note);
  }

  for (const [mode, expectedDinner] of Object.entries(expectedDinnerByMode)) {
    const selection = itineraryFixture.mealSelections[mode]["2026-08-16"];
    const priority = itineraryFixture.mealPriorities[mode]["2026-08-16"];

    assert.equal(selection.lunch, "\uC774\uC7AC\uBAA8\uD53C\uC790");
    assert.equal(priority.lunch[0], "\uC774\uC7AC\uBAA8\uD53C\uC790");
    assert.equal(selection.dinner, expectedDinner);
    assert.equal(priority.dinner[0], expectedDinner);
  }
});

test("overview decisions report rental, Zim Carry, and the 14:31 KTX constraint", () => {
  const decisions = runTripOrchestrator(itineraryFixture).decisions.join(" ");

  assert.match(decisions, /rental pickup/);
  assert.match(decisions, /Zim Carry/);
  assert.match(decisions, /14:31 KTX/);
});

test("meal fixture assigns exactly four breakfast slots and one unique primary genre to every meal slot", () => {
  const slots = Object.values(itineraryFixture.mealSlots).flatMap((day) => Object.values(day));
  const primaryCandidates = slots.map((candidates) => candidates.filter((candidate) => candidate.primary));

  assert.equal(Object.values(itineraryFixture.mealSlots).filter((day) => day.breakfast).length, 4);
  assert.equal(primaryCandidates.length, 12);
  assert.equal(primaryCandidates.every((candidates) => candidates.length === 1), true);
  assert.equal(new Set(primaryCandidates.map(([candidate]) => candidate.genre)).size, 12);
});

test("meal fixture keeps Haeundae rib barbecue as the day 19 lunch primary", () => {
  const candidates = Object.entries(itineraryFixture.mealSlots)
    .flatMap(([date, day]) => Object.entries(day).flatMap(([meal, slotCandidates]) => slotCandidates.map((candidate) => ({ date, meal, candidate }))));
  const ribBarbecueCandidates = candidates.filter(({ candidate }) => candidate.name.includes("\uB9BD \uBC14\uBE44\uD050"));

  assert.deepEqual(ribBarbecueCandidates.map(({ date, meal, candidate }) => ({ date, meal, name: candidate.name, primary: candidate.primary })), [{
    date: "2026-08-19",
    meal: "lunch",
    name: "\uD574\uC6B4\uB300 \uB9BD \uBC14\uBE44\uD050 \uB808\uC2A4\uD1A0\uB791",
    primary: true
  }]);
});

test("every default schedule block provides an ordered time range", () => {
  for (const [date, blocks] of Object.entries(itineraryFixture.defaultBlocks)) {
    for (const block of blocks) {
      assert.match(block.startAt || "", /^\d{2}:\d{2}$/, `${date} ${block.title} startAt`);
      assert.match(block.endAt || "", /^\d{2}:\d{2}$/, `${date} ${block.title} endAt`);
      assert.ok(block.startAt < block.endAt, `${date} ${block.title} has an ordered range`);
    }
  }
});

test("confirmed day 18 rejects a same-area custom request without a safe gap", () => {
  const result = runTripOrchestrator({
    ...itineraryFixture,
    customRequests: {
      "2026-08-18": [{ title: "센텀 카페", area: "센텀" }]
    }
  });
  const day18 = result.days.find((day) => day.date === "2026-08-18");

  assert.equal(day18.openSlot.status, "unavailable");
  assert.equal(day18.openSlot.reason, "no-safe-gap");
  assert.equal(day18.blocks.some((block) => block.title === "센텀 카페"), false);
});

test("keeps only one custom request per day and warns about the second", () => {
  const result = runTripOrchestrator({
    ...itineraryFixture,
    customRequests: {
      "2026-08-18": [{ title: "센텀 카페", area: "센텀" }, { title: "두 번째 요청", area: "센텀" }]
    }
  });

  assert.equal(result.days.find((day) => day.date === "2026-08-18").blocks.some((block) => block.title === "두 번째 요청"), false);
  assert.equal(result.warnings.some((warning) => warning.includes("하루당 한 건")), true);
});

test("allows a same-area day 19 custom request without moving protected blocks", () => {
  const result = runTripOrchestrator({
    ...itineraryFixture,
    customRequests: {
      "2026-08-19": [{ title: "해운대 카페", area: "해운대" }]
    }
  });
  const day19 = result.days.find((day) => day.date === "2026-08-19");

  assert.equal(day19.openSlot.status, "used");
  assert.equal(day19.blocks.some((block) => block.title === "해운대 카페"), true);
  assert.equal(day19.blocks.some((block) => block.time === "14:31" && block.title.includes("KTX")), true);
  assert.equal(result.warnings.some((warning) => warning.includes("안전한 빈 시간")), false);
});

test("food agent returns explicit primary meals and alternatives", () => {
  const result = runTripOrchestrator({ ...itineraryFixture, budgetMode: "light" });
  const slots = result.days.flatMap((day) => day.meals.slots);

  assert.equal(slots.every((slot) => slot.primary === slot.candidates[0]), true);
  assert.equal(slots.every((slot) => slot.alternatives.every((candidate) => candidate !== slot.primary)), true);
  assert.equal(result.warnings.some((warning) => warning.includes("대표 식사 장르")), false);
  assert.equal(result.warnings.some((warning) => warning.includes("안목")), false);
});

test("every budget preserves the confirmed Centum day 18 route", () => {
  const expectedRoute = [
    "\uD30C\uB77C\uB2E4\uC774\uC2A4\uD638\uD154 \uBD80\uC0B0",
    "\uBD80\uC0B0\uC5D1\uC2A4\uB354\uC2A4\uCE74\uC774",
    "\uBBA4\uC9C0\uC5C4\uC6D0",
    "\uBD80\uC0B0\uC601\uD654\uC758\uC804\uB2F9",
    "F1963",
    "\uAD11\uC548\uB9AC",
    "\uD30C\uB77C\uB2E4\uC774\uC2A4\uD638\uD154 \uBD80\uC0B0"
  ];

  for (const budgetMode of ["light", "balanced", "comfort"]) {
    const result = runTripOrchestrator({ ...itineraryFixture, budgetMode });
    const day18 = result.days.find((day) => day.date === "2026-08-18");
    const day19 = result.days.find((day) => day.date === "2026-08-19");
    const returnKtx = result.specialistOutputs.transport.recommendations
      .find((item) => item.date === "2026-08-19" && item.title.includes("KTX"));

    assert.deepEqual(day18.route.sequence, expectedRoute, `${budgetMode} preserves the confirmed Centum route`);
    assert.deepEqual(day19.route.sequence, itineraryFixture.routeSequences["2026-08-19"], `${budgetMode} preserves the confirmed day 19 route`);
    assert.ok(returnKtx, `${budgetMode} returns an explicit day 19 KTX recommendation`);
    assert.equal((returnKtx?.detail ?? "").includes("14:31") || day19.route.sequence.some((stop) => stop.includes("KTX") && stop.includes("14:31")), true, `${budgetMode} retains the 14:31 return KTX`);
    for (const removedDestination of ["\uC624\uC2DC\uB9AC\uC544", "\uAD6D\uB9BD\uBD80\uC0B0\uACFC\uD559\uAD00", "\uC2A4\uCE74\uC774\uB77C\uC778 \uB8E8\uC9C0", "\uB86F\uB370\uC6D4\uB4DC"]) {
      assert.equal(day18.blocks.some((block) => block.title.includes(removedDestination)), false, `${budgetMode} removes ${removedDestination} from day 18 blocks`);
    }
  }
});

test("protected routes reject reordered budget overrides", () => {
  const confirmedRoute = itineraryFixture.routeSequences["2026-08-18"];
  const reorderedRoute = [...confirmedRoute];
  [reorderedRoute[2], reorderedRoute[3]] = [reorderedRoute[3], reorderedRoute[2]];
  const result = runTripOrchestrator({
    ...itineraryFixture,
    budgetMode: "light",
    budgetPlans: {
      ...itineraryFixture.budgetPlans,
      light: {
        ...itineraryFixture.budgetPlans.light,
        routes: { ...itineraryFixture.budgetPlans.light.routes, "2026-08-18": reorderedRoute }
      }
    }
  });

  assert.deepEqual(result.days.find((day) => day.date === "2026-08-18").route.sequence, confirmedRoute);
});

test("every budget exposes both day 18 optional experiences", () => {
  for (const budgetMode of ["light", "balanced", "comfort"]) {
    const result = runTripOrchestrator({ ...itineraryFixture, budgetMode });
    const day18 = result.days.find((day) => day.date === "2026-08-18");

    assert.ok(Array.isArray(day18.activities.options), `${budgetMode} must expose day 18 optional experiences`);
    assert.deepEqual(day18.activities.options.map((experience) => experience.id), ["suyeong-yacht", "centum-ice-rink"]);
  }
});

test("food agent keeps every selected meal separate from five fallbacks in every budget", () => {
  assert.ok(itineraryFixture.mealFallbacks, "fixture must define meal fallback groups");

  for (const budgetMode of ["light", "balanced", "comfort"]) {
    const result = runTripOrchestrator({ ...itineraryFixture, budgetMode });

    for (const [date, mealSlots] of Object.entries(itineraryFixture.mealSlots)) {
      const day = result.days.find((candidate) => candidate.date === date);
      const expectedMeals = Object.keys(mealSlots).sort();

      assert.ok(day, `${budgetMode} must retain ${date}`);
      assert.ok(Array.isArray(day.meals.fallbacks), `${budgetMode} ${date} must expose fallback groups`);
      assert.deepEqual(day.meals.fallbacks.map((group) => group.meal).sort(), expectedMeals, `${budgetMode} ${date} fallback meals must match the fixture`);
      for (const group of day.meals.fallbacks) {
        assert.equal(group.candidates.length, 5, `${budgetMode} ${date} ${group.meal} needs five fallbacks`);
        assert.equal(new Set(group.candidates.map((candidate) => candidate.name)).size, 5, `${budgetMode} ${date} ${group.meal} fallbacks must be unique`);
        assert.equal(group.candidates.some((candidate) => candidate.name === group.selected.name), false, `${budgetMode} ${date} ${group.meal} must not list the selected restaurant as a fallback`);
      }
    }
  }
});

test("validation warns when an active meal slot has no fallback group", () => {
  const input = JSON.parse(JSON.stringify(itineraryFixture));
  delete input.mealFallbacks["2026-08-18"].lunch;

  const result = runTripOrchestrator(input);

  assert.equal(result.warnings.some((warning) => warning.includes("2026-08-18 lunch 대체 식당")), true);
});

test("validation handles malformed meal fallback candidates", () => {
  const input = JSON.parse(JSON.stringify(itineraryFixture));
  input.mealFallbacks["2026-08-18"].lunch = Array(5).fill(null);
  let result;

  assert.doesNotThrow(() => {
    result = runTripOrchestrator(input);
  });

  assert.equal(result.warnings.some((warning) => warning.includes("2026-08-18 lunch 대체 식당")), true);
});

test("validation handles malformed optional experience entries", () => {
  const input = JSON.parse(JSON.stringify(itineraryFixture));
  input.optionalExperiences["2026-08-18"] = [null];
  let result;

  assert.doesNotThrow(() => {
    result = runTripOrchestrator(input);
  });

  assert.equal(result.warnings.some((warning) => warning.includes("2026-08-18 선택 체험")), true);
});

test("validation handles malformed optional experience containers", () => {
  const input = JSON.parse(JSON.stringify(itineraryFixture));
  input.optionalExperiences["2026-08-18"] = {};
  let result;

  assert.doesNotThrow(() => {
    result = runTripOrchestrator(input);
  });

  assert.equal(result.warnings.some((warning) => warning.includes("2026-08-18 선택 체험")), true);
});

test("validation warns when an optional experience has no replacement blocks", () => {
  const input = JSON.parse(JSON.stringify(itineraryFixture));
  input.optionalExperiences["2026-08-18"][0].replaces = [];

  const result = runTripOrchestrator(input);

  assert.equal(result.warnings.some((warning) => warning.includes("suyeong-yacht") && warning.includes("대체 블록")), true);
});

test("budget modes select different primary meals while keeping every selected genre unique", () => {
  const selectedByMode = Object.fromEntries(["light", "balanced", "comfort"].map((budgetMode) => {
    const result = runTripOrchestrator({ ...itineraryFixture, budgetMode });
    return [budgetMode, result.days.flatMap((day) => day.meals.slots.map((slot) => slot.primary))];
  }));

  assert.notDeepEqual(selectedByMode.light.map((meal) => meal.name), selectedByMode.balanced.map((meal) => meal.name));
  assert.notDeepEqual(selectedByMode.comfort.map((meal) => meal.name), selectedByMode.balanced.map((meal) => meal.name));
  for (const meals of Object.values(selectedByMode)) {
    assert.equal(new Set(meals.map((meal) => meal.genre)).size, meals.length);
    assert.equal(meals.filter((meal) => meal.name.includes("\uD574\uC6B4\uB300 \uB9BD \uBC14\uBE44\uD050")).length, 1);
  }
});

test("custom requests reject confirmed day 18 when no safe travel buffer remains", () => {
  const result = runTripOrchestrator({
    ...itineraryFixture,
    customRequests: { "2026-08-18": [{ title: "\uC13C\uD140 \uCE74\uD398", area: "\uC13C\uD140" }] }
  });
  const day18 = result.days.find((day) => day.date === "2026-08-18");

  assert.equal(day18.openSlot.status, "unavailable");
  assert.equal(day18.openSlot.reason, "no-safe-gap");
  assert.equal(day18.blocks.some((block) => block.type === "custom"), false);
});

test("day 18 ignores a Songdo intent profile and keeps the confirmed Centum flow", () => {
  const input = JSON.parse(JSON.stringify(itineraryFixture));
  input.dayFlows.find((day) => day.date === "2026-08-18").intent = "송도 케이블카와 감천문화마을";

  const result = runTripOrchestrator(input);
  const day18 = result.days.find((day) => day.date === "2026-08-18");
  const confirmedBlocks = itineraryFixture.defaultBlocks["2026-08-18"];

  assert.deepEqual(day18.blocks.filter((block) => block.type !== "input"), confirmedBlocks);
  assert.deepEqual(day18.route.sequence, itineraryFixture.routeSequences["2026-08-18"]);
});

test("food agent skips a malformed meal slot and returns an actionable warning", () => {
  const input = JSON.parse(JSON.stringify(itineraryFixture));
  input.mealSlots["2026-08-19"].takeaway = [null];
  let result;

  assert.doesNotThrow(() => {
    result = runTripOrchestrator(input);
  });

  const day19 = result.days.find((day) => day.date === "2026-08-19");
  assert.equal(day19.meals.slots.some((slot) => slot.meal === "takeaway"), false);
  assert.equal(day19.meals.slots.some((slot) => slot.meal === "lunch"), true);
  assert.equal(result.warnings.some((warning) => warning.includes("2026-08-19 takeaway") && warning.includes("유효한 식사 후보")), true);
});

test("custom requests add accepted day 19 requests to the map route and reject off-route areas", () => {
  const accepted = runTripOrchestrator({
    ...itineraryFixture,
    customRequests: { "2026-08-19": [{ title: "\uD574\uC6B4\uB300 \uCE74\uD398", area: "\uD574\uC6B4\uB300" }] }
  });
  const acceptedDay = accepted.days.find((day) => day.date === "2026-08-19");
  assert.equal(acceptedDay.route.sequence.includes("\uD574\uC6B4\uB300 \uCE74\uD398"), true);
  assert.deepEqual(acceptedDay.route.points.find((point) => point.name === "\uD574\uC6B4\uB300 \uCE74\uD398"), {
    name: "\uD574\uC6B4\uB300 \uCE74\uD398", lat: 35.1587, lng: 129.1603
  });

  const rejected = runTripOrchestrator({
    ...itineraryFixture,
    customRequests: { "2026-08-18": [{ title: "\uC1A1\uB3C4 \uC0B0\uCC45", area: "\uC1A1\uB3C4" }] }
  });
  const rejectedDay = rejected.days.find((day) => day.date === "2026-08-18");
  assert.equal(rejectedDay.openSlot.reason, "area-mismatch");
  assert.equal(rejectedDay.route.sequence.includes("\uC1A1\uB3C4 \uC0B0\uCC45"), false);
});

test("food agent labels meal summaries in Korean", () => {
  const result = runTripOrchestrator({ ...itineraryFixture, budgetMode: "light" });
  const day16 = result.specialistOutputs.food.recommendations.find((day) => day.date === "2026-08-16");

  assert.match(day16.meals[0], /^아침:/);
  assert.match(day16.meals[1], /^점심:/);
  assert.match(day16.meals[2], /^저녁:/);
});

test("transport agent exposes rental providers and Zim Carry logistics from the fixture", () => {
  const result = runTripOrchestrator(itineraryFixture);
  const rental = result.specialistOutputs.transport.recommendations.find((item) => item.date === "2026-08-17");
  const luggage = result.specialistOutputs.transport.recommendations.find((item) => item.date === "2026-08-19");

  assert.deepEqual(rental.providers, itineraryFixture.rentalOptions.providers);
  assert.equal(luggage.logistics.url, itineraryFixture.luggageTransfer.url);
  assert.equal(luggage.logistics.name, itineraryFixture.luggageTransfer.name);
  assert.equal(luggage.logistics.origin, itineraryFixture.luggageTransfer.origin);
  assert.equal(luggage.logistics.destination, itineraryFixture.luggageTransfer.destination);
});

test("transport agent preserves an explicit day 19 KTX recommendation", () => {
  const result = runTripOrchestrator(itineraryFixture);
  const returnKtx = result.specialistOutputs.transport.recommendations.find((item) => item.date === "2026-08-19" && item.title.includes("KTX"));

  assert.equal(returnKtx.detail.includes("14:31"), true);
});

test("Paradise checkout luggage recommendation uses Zim Carry instead of station storage", () => {
  const result = runTripOrchestrator(itineraryFixture);
  const paradise = result.specialistOutputs.lodging.recommendations.find((lodging) => lodging.name === "파라다이스호텔 부산");

  assert.match(paradise.luggage, /짐캐리/);
  assert.doesNotMatch(paradise.luggage, /부산역 짐 보관/);
});

test("validation accepts the confirmed rental and luggage-transfer route order", () => {
  const result = runTripOrchestrator(itineraryFixture);

  assert.equal(result.warnings.some((warning) => warning.includes("17일 확정 동선")), false);
  assert.equal(result.warnings.some((warning) => warning.includes("19일 확정 동선")), false);
  assert.equal(result.warnings.some((warning) => warning.includes("렌터카 업체")), false);
  assert.equal(result.warnings.some((warning) => warning.includes("짐캐리 URL")), false);
});

test("budget modes preserve the confirmed day 17 rental and Haedong Yonggungsa route", () => {
  for (const budgetMode of ["light", "balanced", "comfort"]) {
    const result = runTripOrchestrator({ ...itineraryFixture, budgetMode });
    const day17 = result.days.find((day) => day.date === "2026-08-17");

    assert.equal(day17.route.sequence.includes("해동용궁사"), true, `${budgetMode} keeps Haedong Yonggungsa`);
    assert.equal(result.warnings.some((warning) => warning.includes("17일 확정 동선")), false, `${budgetMode} keeps the confirmed route`);
  }
});

test("light budget keeps the confirmed Mipo-Cheongsapo Blue Line block and map route", () => {
  const result = runTripOrchestrator({ ...itineraryFixture, budgetMode: "light" });
  const day17 = result.days.find((day) => day.date === "2026-08-17");

  assert.equal(day17.blocks.some((block) => block.title.includes("미포·청사포 왕복 블루라인파크")), true);
  assert.deepEqual(day17.route.sequence, itineraryFixture.mapRoutePoints["17일"].map((point) => point.name));
});
