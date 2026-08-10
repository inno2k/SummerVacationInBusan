const DAY_ORDER = ["2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19"];
const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

function mealLabel(meal) {
  return MEAL_LABELS[meal] || meal;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function dayByDate(context, date) {
  return context.dayFlows.find((day) => day.date === date) || { date, intent: "여유롭게 이동" };
}

function budgetPlan(context) {
  const mode = selectedBudgetMode(context);
  return context.budgetPlans?.[mode] || {};
}

function selectedBudgetMode(context) {
  return ["light", "balanced", "comfort"].includes(context.budgetMode) ? context.budgetMode : "balanced";
}

function orderMealCandidates(candidates, priorities) {
  const priorityIndex = new Map((priorities || []).map((name, index) => [name, index]));
  return candidates
    .map((candidate, index) => ({ candidate, index, priority: priorityIndex.get(candidate.name) }))
    .sort((left, right) => (left.priority ?? Number.MAX_SAFE_INTEGER) - (right.priority ?? Number.MAX_SAFE_INTEGER) || left.index - right.index)
    .map(({ candidate }) => candidate);
}

function primaryMeal(candidates) {
  return candidates.find((candidate) => candidate.primary) || candidates[0];
}

function selectedMeal(candidates, selectedName) {
  return candidates.find((candidate) => candidate.name === selectedName) || primaryMeal(candidates);
}

function minutesAt(time) {
  const [hours, minutes] = String(time || "").split(":").map(Number);
  return Number.isInteger(hours) && Number.isInteger(minutes) ? hours * 60 + minutes : null;
}

function timeAt(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function requestsForDate(context, date) {
  const requests = context.customRequests?.[date];
  if (!requests) return [];
  return Array.isArray(requests) ? requests : [requests];
}

function areasForDay(context, date, intent, plan) {
  const profile = intentProfile(intent);
  return [
    profile?.hub,
    context.routeHubs?.[date],
    ...(plan.routes?.[date] || []),
    ...(context.routeSequences?.[date] || [])
  ].filter(Boolean);
}

function isCompatibleRequest(request, areas) {
  const area = String(request?.area || "").trim();
  return Boolean(area) && areas.some((candidate) => String(candidate).includes(area) || area.includes(String(candidate)));
}

function mapPointCatalog(context) {
  const catalog = { ...(context.mapPlaceCatalog || {}) };
  Object.values(context.mapRoutePoints || {}).flat().forEach((point) => {
    catalog[point.name] = { lat: point.lat, lng: point.lng };
  });
  return catalog;
}

function mapPointForRequest(context, request) {
  const area = String(request?.area || "").trim();
  const catalog = mapPointCatalog(context);
  const matchedName = Object.keys(catalog).find((name) => name === area || name.includes(area) || area.includes(name));
  return matchedName ? { name: request.title, ...catalog[matchedName] } : null;
}

function openSlotForDay(blocks, request, areas) {
  if (request && !isCompatibleRequest(request, areas)) return { status: "unavailable", reason: "area-mismatch" };
  const timedBlocks = blocks
    .map((block) => ({ ...block, start: minutesAt(block.startAt), end: minutesAt(block.endAt) }))
    .filter((block) => block.start !== null && block.end !== null)
    .sort((left, right) => left.start - right.start);
  for (let index = 0; index < timedBlocks.length - 1; index += 1) {
    const start = timedBlocks[index].end + 15;
    const end = timedBlocks[index + 1].start - 15;
    if (end - start >= 30) return { status: request ? "used" : "available", startAt: timeAt(start), endAt: timeAt(start + 30), availableUntil: timeAt(end) };
  }
  return { status: "unavailable", reason: "no-safe-gap" };
}

function placeCustomRequest(blocks, openSlot, request) {
  if (!request || openSlot.status !== "used") return blocks;
  const customBlock = { time: openSlot.startAt, startAt: openSlot.startAt, endAt: openSlot.endAt, title: request.title, area: request.area, type: "custom" };
  const insertionIndex = blocks.findIndex((block) => minutesAt(block.startAt) !== null && minutesAt(block.startAt) >= minutesAt(customBlock.endAt));
  return insertionIndex === -1 ? [...blocks, customBlock] : [...blocks.slice(0, insertionIndex), customBlock, ...blocks.slice(insertionIndex)];
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
    if (!profile) (plan.addBlocks?.[date] || []).forEach((block) => blocks.push(block));
    if (flow.intent) blocks.unshift({ time: "사용자 요청", title: flow.intent, type: "input" });
    const requests = requestsForDate(context, date);
    const openSlot = openSlotForDay(blocks, requests[0], areasForDay(context, date, flow.intent, plan));
    return { date, intent: flow.intent, blocks: placeCustomRequest(blocks, openSlot, requests[0]), openSlot };
  });
  return { agentId: "schedule", recommendations: days, constraints: ["KTX 시간은 고정"], warnings: [] };
}

function routeAgent(context, schedule) {
  const plan = budgetPlan(context);
  const recommendations = schedule.recommendations.map((day) => {
    const intent = day.intent || "";
    const profile = intentProfile(intent);
    const customHub = profile?.hub || (intent.includes("광안리") || intent.includes("센텀") ? "광안리·센텀" : context.routeHubs[day.date]);
    const budgetSequence = plan.routes?.[day.date];
    const confirmedSequence = context.routeSequences[day.date] || [];
    const hasDay17CoreRoute = ["SK렌터카 부산역지점", "해동용궁사", "미포주차장", "청사포", "해운대 렌터카 반납"].every((stop) => budgetSequence?.includes(stop));
    const hasConfirmedDay17CoreRoute = ["SK렌터카 부산역지점", "해동용궁사", "미포주차장", "청사포", "해운대 렌터카 반납"].every((stop) => confirmedSequence.includes(stop));
    const selectedSequence = day.date === "2026-08-17" && budgetSequence && !hasDay17CoreRoute && hasConfirmedDay17CoreRoute ? confirmedSequence : budgetSequence;
    const customSequence = profile?.sequence || (customHub === "광안리·센텀" ? ["파라다이스호텔", "센텀", "광안리"] : selectedSequence || context.routeSequences[day.date] || []);
    const request = day.blocks.find((block) => block.type === "custom");
    if (request) {
      const customPoint = mapPointForRequest(context, request);
      const anchorIndex = customSequence.findIndex((name) => String(name).includes(request.area) || request.area.includes(String(name)));
      if (customPoint && anchorIndex >= 0) {
        const sequence = [...customSequence.slice(0, anchorIndex + 1), request.title, ...customSequence.slice(anchorIndex + 1)];
        const catalog = mapPointCatalog(context);
        const points = sequence.map((name) => name === request.title ? customPoint : catalog[name] ? { name, ...catalog[name] } : null).filter(Boolean);
        return { date: day.date, intent, hub: customHub, sequence, points, note: "사용자 요청을 권역 내 동선에 반영" };
      }
    }
    return { date: day.date, intent, hub: customHub, sequence: customSequence, note: day.date === "2026-08-17" ? "해운대 관광과 물놀이를 같은 권역에서 마무리" : "권역 간 왕복을 줄이는 방향" };
  });
  return { agentId: "route", recommendations, constraints: ["하루 핵심 권역 1~2개"], warnings: [] };
}

function lodgingAgent(context) {
  const recommendations = context.lodgings.map((lodging) => ({
    ...lodging,
    luggage: lodging.name.includes("아스티") ? "17일 오전 체크아웃 후 파라다이스로 짐 이동" : "19일 체크아웃 후 짐캐리로 부산역에 짐 인계"
  }));
  return { agentId: "lodging", recommendations, constraints: ["16~17일 아스티호텔", "17~19일 파라다이스호텔"], warnings: [] };
}

function transportAgent(context, route) {
  const warnings = [];
  const returnAt = context.fixedTransport.return.arriveAtStation;
  const returnDepartAt = context.fixedTransport.return.departAt;
  const rental = context.rentalOptions;
  const luggage = context.luggageTransfer;
  if (returnAt < "13:30") warnings.push("기존 부산역 도착 목표 대신 11:55~12:15 도착 목표를 적용합니다.");
  const recommendations = [
    { date: "2026-08-16", title: "서울역 KTX", detail: `${context.fixedTransport.outbound.departAt} 출발 → ${context.fixedTransport.outbound.arriveAt} 부산역 도착` },
    { date: "2026-08-17", title: "호텔 간 짐 이동", detail: "아스티호텔 체크아웃 후 파라다이스호텔에 짐 전달" },
    { date: "2026-08-19", title: "부산역 귀환", detail: `11:55~12:15 부산역 도착·짐캐리 수령, 13:45 승강장 이동 버퍼, ${returnDepartAt} KTX 탑승` }
  ];
  if (rental) {
    recommendations[1] = {
      date: rental.date,
      title: rental.providers?.[0]?.name || "Rental pickup",
      detail: [rental.pickup, rental.returnPlan].filter(Boolean).join(" "),
      providers: rental.providers || []
    };
  }
  if (luggage) {
    recommendations[2] = {
      date: luggage.date,
      title: `${luggage.name} hotel handoff and station collection`,
      detail: [`${luggage.name} 호텔 인계: ${luggage.origin} -> ${luggage.destination}`, `부산역 수령: ${luggage.collection}`, luggage.note, "13:45 boarding buffer", `${returnDepartAt} KTX`].filter(Boolean).join(", "),
      logistics: {
        name: luggage.name,
        origin: luggage.origin,
        destination: luggage.destination,
        collection: luggage.collection,
        url: luggage.url,
        note: luggage.note,
        confirmed: luggage.confirmed
      }
    };
    recommendations.push({
      date: luggage.date,
      title: "Return KTX",
      detail: `13:45 boarding buffer, ${returnDepartAt} KTX`
    });
  }
  return { agentId: "transport", recommendations, constraints: ["Rental provider confirmation", "Zim Carry hotel handoff and station collection", `KTX ${returnDepartAt} with a 13:45 boarding buffer`], warnings };
}

function foodAgent(context, route) {
  const plan = budgetPlan(context);
  const mode = selectedBudgetMode(context);
  const recommendations = route.recommendations.map((day) => {
    const slotEntries = Object.entries(context.mealSlots?.[day.date] || {});
    const slots = slotEntries.map(([meal, candidates]) => {
      const priorities = plan.mealPriorities?.[day.date]?.[meal] || context.mealPriorities?.[mode]?.[day.date]?.[meal] || [];
      const selectedName = context.mealSelections?.[mode]?.[day.date]?.[meal] || priorities[0];
      const primary = selectedMeal(candidates, selectedName);
      const orderedCandidates = orderMealCandidates(candidates, [primary.name, ...priorities]);
      return { meal, primary, alternatives: orderedCandidates.filter((candidate) => candidate !== primary), candidates: orderedCandidates };
    });
    const meals = slots.length
      ? slots.map((slot) => `${mealLabel(slot.meal)}: ${slot.candidates[0].name} 외 ${slot.candidates.length - 1}곳`)
      : (intentProfile(day.intent)?.meals || plan.meals?.[day.date] || context.mealCandidates[day.date] || []).slice(0, plan.mealLimit || 3);
    return {
      date: day.date,
      slots,
      meals,
      sourceHint: context.videoSources.filter((source) => source.days.includes(day.date)).slice(0, 2).map((source) => source.id)
    };
  });
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
  const day19 = outputs.schedule.recommendations.find((day) => day.date === "2026-08-19");
  const day19Transport = outputs.transport.recommendations.find((item) => item.date === "2026-08-19");
  const returnDeparture = context.fixedTransport?.return?.departAt;
  const hasReturnKtxBlock = day19?.blocks.some((block) => block.time === "14:31" && block.title.includes("KTX"));
  const hasOrderedStops = (sequence, stops) => {
    let cursor = -1;
    for (const stop of stops) {
      cursor = sequence.indexOf(stop, cursor + 1);
      if (cursor === -1) return false;
    }
    return true;
  };
  const day17Route = outputs.route.recommendations.find((item) => item.date === "2026-08-17")?.sequence || [];
  const day19Route = outputs.route.recommendations.find((item) => item.date === "2026-08-19")?.sequence || [];
  if (!hasOrderedStops(day17Route, ["SK렌터카 부산역지점", "해동용궁사", "미포주차장", "미포", "청사포", "미포", "해운대 렌터카 반납"])) warnings.push("17일 확정 동선에 렌터카 수령, 해동용궁사, 미포 왕복, 해운대 반납이 필요합니다.");
  if (!hasOrderedStops(day19Route, ["파라다이스호텔 체크아웃", "파라다이스호텔 짐캐리 인계", "해운대 립 바비큐 레스토랑", "부산역 짐캐리 수령·탑승 버퍼", "부산역 KTX 출발 14:31"])) warnings.push("19일 확정 동선에 짐캐리 인계, 해운대 점심, 부산역 수령·탑승 버퍼, 14:31 KTX가 필요합니다.");
  if (!Array.isArray(context.rentalOptions?.providers) || context.rentalOptions.providers.length === 0 || !context.rentalOptions.providers.every((provider) => provider.name && /^https:\/\//.test(provider.url || ""))) warnings.push("17일 렌터카 업체 정보와 URL이 필요합니다.");
  if (!/^https:\/\//.test(context.luggageTransfer?.url || "")) warnings.push("19일 짐캐리 URL이 필요합니다.");
  if (!day19?.blocks.some((block) => block.title.includes("짐캐리 인계")) || !day19?.blocks.some((block) => block.title.includes("짐 수령"))) warnings.push("19일 일정에 짐캐리 인계와 부산역 수령이 필요합니다.");
  if (!day19Transport?.detail.includes("짐캐리") || !day19Transport.detail.includes("13:45")) warnings.push("19일 짐캐리 수령과 탑승 버퍼가 부족합니다.");
  if (returnDeparture !== "14:31" || !hasReturnKtxBlock) warnings.push("19일 귀환 KTX는 14:31로 유지해야 합니다.");
  return warnings;
}

function validateMealAndRequests(context, outputs) {
  const warnings = [];
  const primaryMeals = outputs.food.recommendations.flatMap((day) => day.slots.map((slot) => slot.primary).filter(Boolean));
  if (new Set(primaryMeals.map((meal) => meal.genre)).size !== primaryMeals.length) warnings.push("대표 식사 장르가 전 일정에서 중복됩니다.");
  DAY_ORDER.forEach((date) => {
    const requests = requestsForDate(context, date);
    const day = outputs.schedule.recommendations.find((item) => item.date === date);
    if (requests.length > 1) warnings.push(`${date} 새 요청은 하루당 한 건만 자동 배치할 수 있습니다.`);
    if (requests.length && day?.openSlot.status === "unavailable") warnings.push(`${date} 요청을 넣을 안전한 빈 시간이 없거나 동선 권역이 맞지 않습니다.`);
  });
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
    ...validate(context, specialistOutputs),
    ...validateMealAndRequests(context, specialistOutputs)
  ];
  return {
    days: schedule.recommendations.map((day) => ({ ...day, route: route.recommendations.find((item) => item.date === day.date), meals: food.recommendations.find((item) => item.date === day.date), activities: activity.recommendations.find((item) => item.date === day.date) })),
    specialistOutputs,
    decisions: ["17 Aug rental pickup, Haedong Yonggungsa, and Mipo round trip are fixed.", `18일은 ${route.recommendations.find((day) => day.date === "2026-08-18")?.hub || "권역"} 코스를 우선`, `19 Aug Zim Carry hotel handoff and Busan Station collection protect the ${context.fixedTransport.return.departAt} KTX.`],
    warnings,
    changedAt: new Date().toISOString()
  };
}

if (typeof window !== "undefined") window.runTripOrchestrator = runTripOrchestrator;
if (typeof module !== "undefined") module.exports = { runTripOrchestrator, scheduleAgent, routeAgent, lodgingAgent, transportAgent, foodAgent, activityAgent, primaryMeal, openSlotForDay, placeCustomRequest };
