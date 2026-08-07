const DAY_ORDER = ["2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19"];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function dayByDate(context, date) {
  return context.dayFlows.find((day) => day.date === date) || { date, intent: "여유롭게 이동" };
}

function budgetPlan(context) {
  const mode = ["light", "balanced", "comfort"].includes(context.budgetMode) ? context.budgetMode : "balanced";
  return context.budgetPlans?.[mode] || {};
}

function intentProfile(intent) {
  const value = String(intent || "");
  if (value.includes("송도") || value.includes("감천")) {
    return {
      hub: "송도·감천",
      sequence: ["파라다이스호텔", "감천문화마을", "송도 케이블카"],
      blocks: [{ time: "오전", title: "감천문화마을", type: "place" }, { time: "오후", title: "송도 케이블카·송도해수욕장", type: "activity" }, { time: "저녁", title: "송도권 식사", type: "food" }],
      meals: ["송도 해산물", "감천 카페·간식", "남포 귀환 식사"],
      activities: [{ title: "감천문화마을", area: "감천", audience: ["12살", "가족"], weather: "clear" }, { title: "송도 케이블카", area: "송도", audience: ["12살", "가족"], weather: "clear" }]
    };
  }
  return null;
}

function scheduleAgent(context) {
  const plan = budgetPlan(context);
  const days = DAY_ORDER.map((date) => {
    const flow = dayByDate(context, date);
    const profile = intentProfile(flow.intent);
    const removeKeywords = plan.removeKeywords?.[date] || [];
    const blocks = profile ? [...(context.defaultBlocks[date] || [])].filter((block) => ["fixed", "lodging"].includes(block.type)) : [...(context.defaultBlocks[date] || [])].filter((block) => !removeKeywords.some((keyword) => block.title.includes(keyword)));
    if (profile) profile.blocks.forEach((block) => blocks.push(block));
    (plan.addBlocks?.[date] || []).forEach((block) => blocks.push(block));
    if (flow.intent) blocks.unshift({ time: "사용자 요청", title: flow.intent, type: "input" });
    return { date, intent: flow.intent, blocks };
  });
  return { agentId: "schedule", recommendations: days, constraints: ["KTX 시간은 고정"], warnings: [] };
}

function routeAgent(context, schedule) {
  const plan = budgetPlan(context);
  const recommendations = schedule.recommendations.map((day) => {
    const intent = day.intent || "";
    const profile = intentProfile(intent);
    const customHub = profile?.hub || (intent.includes("광안리") || intent.includes("센텀") ? "광안리·센텀" : intent.includes("남포") || intent.includes("영도") ? "남포·영도" : context.routeHubs[day.date]);
    const customSequence = profile?.sequence || (customHub === "광안리·센텀" ? ["파라다이스호텔", "센텀", "광안리"] : customHub === "남포·영도" ? ["부산역", "남포·자갈치", "영도"] : plan.routes?.[day.date] || context.routeSequences[day.date] || []);
    return { date: day.date, intent, hub: customHub, sequence: customSequence, note: day.date === "2026-08-17" ? "해운대 관광과 물놀이를 같은 권역에서 마무리" : "권역 간 왕복을 줄이는 방향" };
  });
  return { agentId: "route", recommendations, constraints: ["하루 핵심 권역 1~2개"], warnings: [] };
}

function lodgingAgent(context) {
  const recommendations = context.lodgings.map((lodging) => ({
    ...lodging,
    luggage: lodging.name.includes("아스티") ? "17일 오전 체크아웃 후 파라다이스로 짐 이동" : "19일 체크아웃 후 호텔 짐 보관 요청"
  }));
  return { agentId: "lodging", recommendations, constraints: ["16~17일 아스티호텔", "17~19일 파라다이스호텔"], warnings: [] };
}

function transportAgent(context, route) {
  const warnings = [];
  const returnAt = context.fixedTransport.return.arriveAtStation;
  if (returnAt < "13:30") warnings.push("부산역 도착 여유가 짧습니다.");
  const recommendations = [
    { date: "2026-08-16", title: "서울역 KTX", detail: `${context.fixedTransport.outbound.departAt} 출발 → ${context.fixedTransport.outbound.arriveAt} 부산역 도착` },
    { date: "2026-08-17", title: "호텔 간 짐 이동", detail: "아스티호텔 체크아웃 후 파라다이스호텔에 짐 전달" },
    { date: "2026-08-19", title: "부산역 귀환", detail: `씨메르 후 ${returnAt}까지 부산역 도착, ${context.fixedTransport.return.departAt} KTX 탑승` }
  ];
  return { agentId: "transport", recommendations, constraints: ["KTX 30분 전 부산역 도착 권장"], warnings };
}

function foodAgent(context, route) {
  const plan = budgetPlan(context);
  const recommendations = route.recommendations.map((day) => ({
    date: day.date,
    meals: (intentProfile(day.intent)?.meals || plan.meals?.[day.date] || context.mealCandidates[day.date] || []).slice(0, plan.mealLimit || 3),
    sourceHint: context.videoSources.filter((source) => source.days.includes(day.date)).slice(0, 2).map((source) => source.id)
  }));
  return { agentId: "food", recommendations, constraints: ["영상 추천은 영업/예약 여부 재확인"], warnings: [] };
}

function activityAgent(context, route) {
  const plan = budgetPlan(context);
  const recommendations = route.recommendations.map((day) => {
    const profile = intentProfile(day.intent);
    const candidates = [...(context.activityCandidates[day.date] || []), ...(profile?.activities || [])];
    const preferredTitles = profile?.activities?.map((item) => item.title) || plan.activities?.[day.date];
    const chosen = preferredTitles ? candidates.filter((item) => preferredTitles.includes(item.title)) : day.hub === "광안리·센텀" ? candidates.filter((item) => ["광안리", "센텀"].includes(item.area)) : day.date === "2026-08-18" ? candidates.filter((item) => item.audience.includes("12살")) : candidates;
    return { date: day.date, chosen: chosen.slice(0, 4), rainyAlternative: candidates.find((item) => item.weather === "rain") };
  });
  return { agentId: "activity", recommendations, constraints: ["18일은 해운대 반복을 피하고 오시리아 우선"], warnings: [] };
}

function validate(context, outputs) {
  const warnings = [];
  const day17 = outputs.schedule.recommendations.find((day) => day.date === "2026-08-17");
  const day18 = outputs.activity.recommendations.find((day) => day.date === "2026-08-18");
  if (!day17?.intent?.includes("해운대") && !day17?.intent?.includes("물놀이")) {
    warnings.push("17일 흐름에 해운대 물놀이가 드러나지 않습니다. 기본 블록은 유지됩니다.");
  }
  if (day18?.chosen.some((item) => item.area === "해운대")) warnings.push("18일 후보에 해운대가 포함되어 다른 권역 우선 원칙과 충돌합니다.");
  if (!context.dayFlows.some((day) => day.date === "2026-08-19" && day.intent.includes("씨메르"))) warnings.push("19일 오전 씨메르 요청이 입력에 없습니다.");
  return warnings;
}

function runTripOrchestrator(input) {
  const context = clone(input);
  const schedule = scheduleAgent(context);
  const route = routeAgent(context, schedule);
  const lodging = lodgingAgent(context);
  const transport = transportAgent(context, route);
  const food = foodAgent(context, route);
  const activity = activityAgent(context, route);
  const specialistOutputs = { schedule, route, lodging, transport, food, activity };
  const warnings = [
    ...schedule.warnings,
    ...route.warnings,
    ...lodging.warnings,
    ...transport.warnings,
    ...food.warnings,
    ...activity.warnings,
    ...validate(context, specialistOutputs)
  ];
  return {
    days: schedule.recommendations.map((day) => ({ ...day, route: route.recommendations.find((item) => item.date === day.date), meals: food.recommendations.find((item) => item.date === day.date), activities: activity.recommendations.find((item) => item.date === day.date) })),
    specialistOutputs,
    decisions: ["17일에 해운대 관광과 물놀이를 통합", `18일은 ${route.recommendations.find((day) => day.date === "2026-08-18")?.hub || "권역"} 코스를 우선`, "19일 씨메르 후 KTX 버퍼를 유지"],
    warnings,
    changedAt: new Date().toISOString()
  };
}

if (typeof window !== "undefined") window.runTripOrchestrator = runTripOrchestrator;
if (typeof module !== "undefined") module.exports = { runTripOrchestrator, scheduleAgent, routeAgent, lodgingAgent, transportAgent, foodAgent, activityAgent };
