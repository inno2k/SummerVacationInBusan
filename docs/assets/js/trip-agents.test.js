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

test("manager changes the 18th route when the user requests Gwangalli and Centum", () => {
  const changed = { ...context, dayFlows: context.dayFlows.map((day) => day.date === "2026-08-18" ? { ...day, intent: "광안리 요트와 센텀 휴식" } : day), activityCandidates: { ...context.activityCandidates, "2026-08-18": [{ title: "광안리 요트", area: "광안리", audience: ["12살"] }, { title: "센텀 스파랜드", area: "센텀", audience: ["가족"] }] } };
  const result = runTripOrchestrator(changed);
  assert.equal(result.days[2].route.hub, "광안리·센텀");
  assert.deepEqual(result.days[2].route.sequence, ["파라다이스호텔", "센텀", "광안리"]);
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
    dayFlows: context.dayFlows.map((day) => day.date === "2026-08-18" ? { ...day, intent: "\uC1A1\uB3C4 \uCF00\uC774\uBE14\uCE74\uC640 \uAC10\uCC9C\uBB38\uD654\uB9C8\uC744" } : day),
    defaultBlocks: { ...context.defaultBlocks, "2026-08-18": [{ title: "\uC2A4\uCE74\uC774\uB77C\uC778 \uB8E8\uC9C0", type: "paid" }] },
    mealCandidates: { ...context.mealCandidates, "2026-08-18": ["\uC624\uC2DC\uB9AC\uC544 \uC2DD\uB2F9\uAC00"] },
    activityCandidates: { ...context.activityCandidates, "2026-08-18": [{ title: "\uAD11\uC548\uB9AC \uC0B0\uCC45\u00B7\uBBFC\uB77D\uC218\uBCC0 \uD734\uC2DD", area: "\uAD11\uC548\uB9AC", audience: ["12\uC0B4", "\uAC00\uC871"], weather: "clear" }] }
  };
  const result = runTripOrchestrator(changed);
  const day18 = result.days[2];
  assert.equal(day18.route.hub, "\uC1A1\uB3C4\u00B7\uAC10\uCC9C");
  assert.deepEqual(day18.route.sequence, ["\uD30C\uB77C\uB2E4\uC774\uC2A4\uD638\uD154", "\uAC10\uCC9C\uBB38\uD654\uB9C8\uC744", "\uC1A1\uB3C4 \uCF00\uC774\uBE14\uCE74"]);
  assert.equal(day18.blocks.some((block) => block.title === "\uAC10\uCC9C\uBB38\uD654\uB9C8\uC744"), true);
  assert.equal(day18.meals.meals[0], "\uC1A1\uB3C4 \uD574\uC0B0\uBB3C");
  assert.equal(day18.activities.chosen.some((item) => item.title === "\uC1A1\uB3C4 \uCF00\uC774\uBE14\uCE74"), true);
});

test("custom destination overrides paid additions from the previous region", () => {
  const changed = {
    ...context,
    budgetMode: "comfort",
    budgetPlans: { comfort: { addBlocks: { "2026-08-18": [{ title: "\uC2A4\uCE74\uC774\uB77C\uC778 \uB8E8\uC9C0\u00B7\uC624\uC2DC\uB9AC\uC544 \uD0DD\uC2DC \uC774\uB3D9", type: "activity" }] }, routes: {}, activities: {} } },
    dayFlows: context.dayFlows.map((day) => day.date === "2026-08-18" ? { ...day, intent: "\uC1A1\uB3C4 \uCF00\uC774\uBE14\uCE74\uC640 \uAC10\uCC9C\uBB38\uD654\uB9C8\uC744" } : day)
  };
  const result = runTripOrchestrator(changed);
  assert.equal(result.days[2].blocks.some((block) => block.title.includes("\uC2A4\uCE74\uC774\uB77C\uC778")), false);
  assert.equal(result.days[2].route.sequence.includes("\uC1A1\uB3C4 \uCF00\uC774\uBE14\uCE74"), true);
});

test("unknown budget mode falls back to balanced behavior", () => {
  const changed = { ...context, budgetMode: "unknown", budgetPlans: { balanced: { mealLimit: 3, routes: {}, removeKeywords: {}, addBlocks: {}, activities: {} } } };
  const result = runTripOrchestrator(changed);
  assert.equal(result.days[2].route.hub, context.routeHubs["2026-08-18"]);
  assert.deepEqual(result.days[2].meals.meals, []);
});

test("food agent exposes every meal slot and retains three candidates in light mode", () => {
  const result = runTripOrchestrator({ ...itineraryFixture, budgetMode: "light" });

  for (const day of result.specialistOutputs.food.recommendations) {
    assert.deepEqual(day.slots.map((slot) => slot.meal), ["lunch", "dinner"]);
    for (const slot of day.slots) {
      assert.ok(slot.candidates.length >= 3, `${day.date} ${slot.meal} keeps three candidates`);
    }
    assert.ok(day.meals.length >= 2, `${day.date} has concise meal summaries`);
  }

  const day17 = result.days.find((day) => day.date === "2026-08-17");
  assert.equal(day17.meals.slots[1].candidates.some((candidate) => candidate.name === "해운대암소갈비집"), true);
});

test("day 19 agents require Busan Station luggage storage and exclude Cimer", () => {
  const result = runTripOrchestrator(itineraryFixture);
  const paradise = result.specialistOutputs.lodging.recommendations.find((lodging) => lodging.name === "파라다이스호텔 부산");
  const returnTrip = result.specialistOutputs.transport.recommendations.find((item) => item.date === "2026-08-19");

  assert.match(paradise.luggage, /부산역 짐 보관/);
  assert.match(returnTrip.detail, /11:55~12:15/);
  assert.match(returnTrip.detail, /13:45/);
  assert.match(returnTrip.detail, /14:31/);
  assert.doesNotMatch(returnTrip.detail, /씨메르/);
  assert.equal(result.decisions.some((decision) => decision.includes("19일 씨메르")), false);
  assert.equal(result.warnings.some((warning) => warning.includes("씨메르")), false);
});

test("rebalanced fixture assigns Cimer to day 17 and keeps the day 19 route direct", () => {
  const result = runTripOrchestrator(itineraryFixture);
  const day17 = result.days.find((day) => day.date === "2026-08-17");
  const day19 = result.days.find((day) => day.date === "2026-08-19");

  assert.equal(day17.blocks.some((block) => block.title.includes("\uC528\uBA54\uB974")), true);
  assert.equal(day19.blocks.some((block) => block.title.includes("\uC528\uBA54\uB974")), false);
  assert.deepEqual(day19.route.sequence, ["\uD30C\uB77C\uB2E4\uC774\uC2A4\uD638\uD154", "\uBD80\uC0B0\uC5ED"]);
  assert.deepEqual(itineraryFixture.mapRoutePoints["\u0031\u0039\uC77C"].map((point) => point.name), ["\uD30C\uB77C\uB2E4\uC774\uC2A4\uD638\uD154", "\uBD80\uC0B0\uC5ED"]);

  const cimerDates = Object.entries(itineraryFixture.activityCandidates)
    .filter(([, candidates]) => candidates.some((candidate) => candidate.title.includes("\uC528\uBA54\uB974")))
    .map(([date]) => date);
  assert.deepEqual(cimerDates, ["2026-08-17"]);
});

test("rebalanced fixture provides distinct lunch and dinner restaurant options for every day", () => {
  for (const date of ["2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19"]) {
    for (const meal of ["lunch", "dinner"]) {
      const candidates = itineraryFixture.mealSlots?.[date]?.[meal] || [];
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

  assert.equal(hasBlock("2026-08-16", "\uD770\uC5EC\uC6B8\uBB38\uD654\uB9C8\uC744(\uB9D1\uC74C)"), true);
  assert.equal(hasBlock("2026-08-16", "\uAD6D\uB9BD\uD574\uC591\uBC15\uBB3C\uAD00(\uBE44)"), true);
  assert.equal(hasBlock("2026-08-17", "\uD30C\uB77C\uB2E4\uC774\uC2A4\uD638\uD154 \uC9D0 \uC804\uB2EC"), true);
  assert.equal(hasBlock("2026-08-17", "\uD574\uC6B4\uB300\u00B7\uBE14\uB8E8\uB77C\uC778\uD30C\uD06C\u00B7\uBBF8\uD3EC\u00B7\uCCAD\uC0AC\uD3EC"), true);
  assert.equal(hasBlock("2026-08-17", "\uC624\uC158\uD480 \uB610\uB294 \uC528\uBA54\uB974"), true);

  const day18Activities = activitiesFor("2026-08-18");
  assert.equal(day18Activities.some((activity) => activity.title === "\uB86F\uB370\uC6D4\uB4DC \uBD80\uC0B0" && activity.weather === "clear"), true);
  assert.equal(day18Activities.some((activity) => activity.title === "\uAD6D\uB9BD\uBD80\uC0B0\uACFC\uD559\uAD00" && activity.weather === "rain"), true);
  assert.equal(day18Activities.some((activity) => activity.title === "\uC2A4\uCE74\uC774\uB77C\uC778 \uB8E8\uC9C0" && activity.weather === "clear"), true);

  assert.equal(hasBlock("2026-08-19", "\uC5ED\uB0B4 \uC9D0 \uBCF4\uAD00"), true);
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
  assert.equal(hasCandidate("2026-08-18", "dinner", "\uC548\uBAA9 \uB0A8\uCC9C\uB3D9", "\uB0A8\uCC9C"), true);
  assert.equal(hasCandidate("2026-08-19", "lunch", "\uC548\uBAA9 \uBD80\uC0B0\uC5ED\uC810", "\uBD80\uC0B0\uC5ED"), true);
});
