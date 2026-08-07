const test = require("node:test");
const assert = require("node:assert/strict");
const { runTripOrchestrator } = require("./trip-agents.js");

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

test("manager preserves return train and flags missing Cimer intent", () => {
  const changed = { ...context, dayFlows: context.dayFlows.map((day) => day.date === "2026-08-19" ? { ...day, intent: "아침 식사 후 귀환" } : day) };
  const result = runTripOrchestrator(changed);
  assert.equal(result.specialistOutputs.transport.recommendations[2].detail.includes("14:31"), true);
  assert.equal(result.warnings.some((warning) => warning.includes("씨메르")), true);
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

test("unknown budget mode falls back to balanced behavior", () => {
  const changed = { ...context, budgetMode: "unknown", budgetPlans: { balanced: { mealLimit: 3, routes: {}, removeKeywords: {}, addBlocks: {}, activities: {} } } };
  const result = runTripOrchestrator(changed);
  assert.equal(result.days[2].route.hub, context.routeHubs["2026-08-18"]);
  assert.deepEqual(result.days[2].meals.meals, []);
});
