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
