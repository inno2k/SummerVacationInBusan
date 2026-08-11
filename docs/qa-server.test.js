const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { runTripOrchestrator } = require("./assets/js/trip-agents.js");

const docsRoot = path.resolve(__dirname);
const serverSource = fs.readFileSync(path.join(docsRoot, "qa-server.js"), "utf8");
const appSource = fs.readFileSync(path.join(docsRoot, "assets", "js", "app.js"), "utf8");
const fixtureSource = fs.readFileSync(path.join(docsRoot, "assets", "data", "busan-family-trip-2026.json"), "utf8");
const tripFixture = JSON.parse(fixtureSource);

/**
 * Load the QA server module into a VM with a fake HTTP server and filesystem.
 * @param {{readFile?: (filePath: string, callback: (error: Error|null, data?: Buffer|string) => void) => void}} [options]
 * @returns {{handler: Function, moduleExports: Record<string, unknown>}}
 */
function loadHarness(options = {}) {
  let handler = null;
  const httpStub = {
    createServer(requestHandler) {
      handler = requestHandler;
      return {
        listen() {}
      };
    }
  };

  const fsStub = {
    readFile(filePath, callback) {
      if (options.readFile) {
        options.readFile(filePath, callback);
        return;
      }

      callback(new Error("ENOENT"));
    }
  };

  const moduleObject = { exports: {} };

  vm.runInNewContext(serverSource, {
    require(moduleName) {
      if (moduleName === "http") {
        return httpStub;
      }

      if (moduleName === "fs") {
        return fsStub;
      }

      if (moduleName === "path") {
        return path;
      }

      throw new Error(`Unsupported module: ${moduleName}`);
    },
    __dirname: docsRoot,
    module: moduleObject,
    exports: moduleObject.exports,
    Buffer
  }, { filename: "qa-server.js" });

  if (typeof handler !== "function") {
    throw new Error("Failed to capture QA server request handler");
  }

  return {
    handler,
    moduleExports: moduleObject.exports
  };
}

/**
 * Build a minimal response double for the QA server handler.
 * @returns {{statusCode: number|null, headers: Record<string, string>|null, body: string, writeHead: Function, end: Function}}
 */
function createResponseRecorder() {
  return {
    statusCode: null,
    headers: null,
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers || null;
    },
    end(body = "") {
      this.body = body;
    }
  };
}

function testMalformedEncoding() {
  const { handler } = loadHarness();
  const res = createResponseRecorder();

  assert.doesNotThrow(() => {
    handler({ url: "/%E0%A4%A" }, res);
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body, "Bad Request");
}

function testSiblingTraversal() {
  let readAttemptPath = null;
  const { handler } = loadHarness({
    readFile(filePath, callback) {
      readAttemptPath = filePath;
      callback(new Error("ENOENT"));
    }
  });
  const res = createResponseRecorder();

  handler({ url: "/../docs-evil/probe.txt" }, res);

  assert.equal(readAttemptPath, null);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body, "Forbidden");
}

function testMealSlotsHaveDisplayableCandidateData() {
  for (const [date, meals] of Object.entries(tripFixture.mealSlots)) {
    for (const [meal, candidates] of Object.entries(meals)) {
      assert.ok(candidates.length >= 3, `${date} ${meal} needs three candidates`);
      for (const candidate of candidates) {
        assert.ok(candidate.genre, `${date} ${meal} candidate needs a genre`);
        assert.ok(candidate.area, `${date} ${meal} candidate needs an area`);
        assert.ok(candidate.note, `${date} ${meal} candidate needs a routing note`);
        assert.match(candidate.url, /^https:\/\//, `${date} ${meal} candidate needs an HTTPS map link`);
      }
    }
  }
}

function testCentumFixtureRemovesOsiriaDestinationCopy() {
  for (const removedDestination of ["\uC624\uC2DC\uB9AC\uC544", "\uAD6D\uB9BD\uBD80\uC0B0\uACFC\uD559\uAD00", "\uC2A4\uCE74\uC774\uB77C\uC778 \uB8E8\uC9C0", "\uB86F\uB370\uC6D4\uB4DC"]) {
    assert.doesNotMatch(fixtureSource, new RegExp(removedDestination), `fixture must not contain ${removedDestination}`);
  }
}

function testCentumFixtureDefinesDay18RouteAndOptionalExperiences() {
  const expectedDay18Route = [
    "\uD30C\uB77C\uB2E4\uC774\uC2A4\uD638\uD154 \uBD80\uC0B0",
    "\uBD80\uC0B0\uC5D1\uC2A4\uB354\uC2A4\uCE74\uC774",
    "\uBBA4\uC9C0\uC5C4\uC6D0",
    "\uBD80\uC0B0\uC601\uD654\uC758\uC804\uB2F9",
    "F1963",
    "\uAD11\uC548\uB9AC",
    "\uD30C\uB77C\uB2E4\uC774\uC2A4\uD638\uD154 \uBD80\uC0B0"
  ];
  const expectedDay18Points = [
    { name: "\uD30C\uB77C\uB2E4\uC774\uC2A4\uD638\uD154 \uBD80\uC0B0", lat: 35.1605, lng: 129.1635 },
    { name: "\uBD80\uC0B0\uC5D1\uC2A4\uB354\uC2A4\uCE74\uC774", lat: 35.1598, lng: 129.1707 },
    { name: "\uBBA4\uC9C0\uC5C4\uC6D0", lat: 35.1686, lng: 129.1303 },
    { name: "\uBD80\uC0B0\uC601\uD654\uC758\uC804\uB2F9", lat: 35.171, lng: 129.1288 },
    { name: "F1963", lat: 35.166, lng: 129.1156 },
    { name: "\uAD11\uC548\uB9AC", lat: 35.1532, lng: 129.1187 },
    { name: "\uD30C\uB77C\uB2E4\uC774\uC2A4\uD638\uD154 \uBD80\uC0B0", lat: 35.1605, lng: 129.1635 }
  ];
  const expectedBlocks = [
    ["haeundae-breakfast", "08:00", "09:00", "\uD574\uC6B4\uB300 \uC544\uCE68\uC2DD\uC0AC\u00B7\uD30C\uB77C\uB2E4\uC774\uC2A4\uD638\uD154 \uCD9C\uBC1C", "food"],
    ["x-the-sky", "09:30", "11:00", "\uBD80\uC0B0\uC5D1\uC2A4\uB354\uC2A4\uCE74\uC774", "activity"],
    ["centum-lunch", "11:15", "12:45", "\uC13C\uD140 \uC774\uB3D9\u00B7\uC810\uC2EC\uC2DD\uC0AC", "food"],
    ["museum-1", "13:00", "14:40", "\uBBA4\uC9C0\uC5C4\uC6D0 \uBBF8\uB514\uC5B4\uC544\uD2B8", "activity"],
    ["cinema-center", "15:00", "15:45", "\uBD80\uC0B0\uC601\uD654\uC758\uC804\uB2F9 \uAD11\uC7A5", "place"],
    ["f1963", "16:15", "17:30", "F1963 \uBB38\uD654\u00B7\uD734\uC2DD", "place"],
    ["gwangalli-dinner", "18:00", "20:00", "\uAD11\uC548\uB9AC \uC800\uB141\uC2DD\uC0AC\u00B7\uC57C\uACBD", "food"],
    ["paradise-return", "20:00", "20:30", "\uD30C\uB77C\uB2E4\uC774\uC2A4\uD638\uD154 \uBD80\uC0B0 \uBCF5\uADC0", "transport"]
  ];
  const optionalExperiences = tripFixture.optionalExperiences["2026-08-18"];

  assert.deepEqual(tripFixture.routeSequences["2026-08-18"], expectedDay18Route);
  assert.deepEqual(tripFixture.mapRoutePoints["18\uC77C"], expectedDay18Points);
  assert.deepEqual(tripFixture.defaultBlocks["2026-08-18"].map((block) => [block.id, block.startAt, block.endAt, block.title, block.type]), expectedBlocks);
  assert.deepEqual(optionalExperiences.map((experience) => experience.id), ["suyeong-yacht", "centum-ice-rink"]);
  assert.deepEqual(optionalExperiences, [
    { id: "suyeong-yacht", title: "\uC218\uC601\uB9CC \uC694\uD2B8 \uCCB4\uD5D8", area: "\uC218\uC601\uB9CC \uC694\uD2B8\uACBD\uAE30\uC7A5", durationMinutes: 60, replaces: ["cinema-center", "f1963"], costPolicy: "\uC608\uC57D \uC2DC\uC810\uC758 \uC131\uC218\uAE30\u00B7\uC2DC\uAC04\uB300\u00B7\uC778\uC6D0\uBCC4 \uC694\uAE08 \uD655\uC778", conditions: "\uBE44, \uAC15\uD48D, \uD574\uC0C1 \uC0C1\uD0DC\uC640 \uC120\uC7A5 \uD310\uB2E8\uC5D0 \uB530\uB77C \uCDE8\uC18C \uB610\uB294 \uC77C\uC815 \uBCC0\uACBD \uAC00\uB2A5", sourceUrl: "https://www.visitbusan.net/index.do?lang_cd=en&menuCd=DOM_000000304004001000&uc_seq=1775" },
    { id: "centum-ice-rink", title: "\uC2E0\uC138\uACC4 \uC13C\uD140 \uC544\uC774\uC2A4\uB9C1\uD06C", area: "\uC13C\uD140\uC2DC\uD2F0", durationMinutes: 120, replaces: ["cinema-center", "f1963"], costPolicy: "\uD604\uC7A5 \uB610\uB294 \uC608\uC57D \uD654\uBA74\uC758 \uB2F9\uC77C \uC694\uAE08 \uD655\uC778", conditions: "\uC6B4\uC601\uC2DC\uAC04, \uD68C\uCC28, \uC7A5\uAC11\u00B7\uC591\uB9D0\u00B7\uBCF4\uD638\uC7A5\uBE44 \uC870\uAC74\uC744 \uB2F9\uC77C \uD655\uC778", sourceUrl: "https://www.shinsegae.com/department/store/centum/ice-rink" }
  ]);

  for (const budget of Object.values(tripFixture.budgets)) {
    const reservation = budget.items.find((item) => item.label === "\uC120\uD0DD \uCCB4\uD5D8");

    assert.ok(reservation, "every budget must include an optional-experience reservation line");
    assert.deepEqual(reservation, { label: "\uC120\uD0DD \uCCB4\uD5D8", amount: "\uC608\uC57D \uC2DC \uD655\uC778", detail: "\uC218\uC601\uB9CC \uC694\uD2B8 \uB610\uB294 \uC13C\uD140 \uC544\uC774\uC2A4\uB9C1\uD06C\uB294 \uAE30\uBCF8 \uC608\uC0B0\uC5D0 \uD3EC\uD568\uD558\uC9C0 \uC54A\uC74C" });
    assert.match(budget.total, /^\uC57D \d+\uB9CC\uC6D0$/, "baseline total remains a fixed numeric plan total");
  }

  for (const plan of Object.values(tripFixture.budgetPlans)) {
    for (const key of ["removeKeywords", "addBlocks", "routes", "meals", "activities"]) {
      assert.equal(Object.hasOwn(plan[key] || {}, "2026-08-18"), false, `budget plan must not override day 18 ${key}`);
    }
  }
}

function testMealFallbackFixtureProvidesFiveActionableAlternatives() {
  assert.ok(tripFixture.mealFallbacks, "fixture must define meal fallbacks");
  assert.deepEqual(Object.keys(tripFixture.mealFallbacks).sort(), Object.keys(tripFixture.mealSlots).sort(), "meal fallback dates must match meal slot dates");
  for (const [date, mealSlots] of Object.entries(tripFixture.mealSlots)) {
    const expectedMeals = Object.keys(mealSlots)
      .map((meal) => date === "2026-08-19" && meal === "dinner" ? "takeaway" : meal)
      .sort();
    const fallbackMeals = Object.keys(tripFixture.mealFallbacks[date] || {}).sort();

    assert.deepEqual(fallbackMeals, expectedMeals, `${date} fallback meals must cover every meal slot`);
  }
  for (const [date, meals] of Object.entries(tripFixture.mealFallbacks)) {
    for (const [meal, fallbacks] of Object.entries(meals)) {
      assert.equal(fallbacks.length, 5, `${date} ${meal} needs exactly five fallbacks`);
      assert.equal(new Set(fallbacks.map((fallback) => fallback.name)).size, 5, `${date} ${meal} fallbacks must be unique`);
      for (const fallback of fallbacks) {
        assert.match(fallback.url, /^https:\/\//, `${date} ${meal} fallback needs an HTTPS URL`);
        assert.ok(["go-now", "check-wait", "operation-check"].includes(fallback.waitRisk), `${date} ${meal} fallback needs a recognized wait risk`);
        assert.ok(fallback.note.trim().length >= 10, `${date} ${meal} fallback needs an actionable note`);
      }
    }
  }

  const day19Fallbacks = tripFixture.mealFallbacks["2026-08-19"];
  assert.equal(day19Fallbacks.dinner, undefined, "19 Aug must not provide dinner fallbacks");
  assert.ok(Array.isArray(day19Fallbacks.takeaway), "19 Aug must provide takeaway fallbacks");
}

function testBreakfastRentalAndLuggageFixture() {
  const dates = ["2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19"];
  const expectedDay17Route = [
    "아스티호텔 부산",
    "SK렌터카 부산역지점",
    "파라다이스호텔 부산",
    "해동용궁사",
    "미포주차장",
    "미포",
    "청사포",
    "미포",
    "파라다이스호텔 부산",
    "해운대해수욕장",
    "해운대 렌터카 반납"
  ];
  const expectedDay19Route = [
    "파라다이스호텔 체크아웃",
    "파라다이스호텔 짐캐리 인계",
    "해운대 립 바비큐 레스토랑",
    "부산역 짐캐리 수령·탑승 버퍼",
    "부산역 KTX 출발 14:31"
  ];

  for (const date of dates) {
    assert.ok(tripFixture.mealSlots[date].breakfast, `${date} needs a breakfast slot`);
    assert.ok(tripFixture.mealSlots[date].breakfast.length >= 3, `${date} breakfast needs three candidates`);
  }
  assert.equal(tripFixture.fixedTransport.outbound.departAt, "07:58");
  tripFixture.mealSlots["2026-08-16"].breakfast.forEach((candidate) => {
    assert.equal(candidate.area, "서울역", "16 Aug breakfast must be in the Seoul Station area before KTX departure");
    assert.match(candidate.note, /07:58.*출발 전/);
  });

  const day17Titles = tripFixture.defaultBlocks["2026-08-17"].map((block) => block.title);
  ["아스티호텔 체크아웃", "렌터카 수령", "파라다이스호텔 부산 짐 전달", "해동용궁사", "미포주차장", "블루라인파크", "파라다이스호텔 물놀이", "해운대해수욕장", "해운대 렌터카 반납"].forEach((expected) => {
    assert.ok(day17Titles.some((title) => title.includes(expected)), `17 Aug needs ${expected}`);
  });
  assert.deepEqual(tripFixture.routeSequences["2026-08-17"], expectedDay17Route);
  assert.deepEqual(tripFixture.mapRoutePoints["17일"].map((point) => point.name), expectedDay17Route);

  assert.equal(tripFixture.rentalCar, undefined, "rentalCar must be replaced by rentalOptions");
  assert.equal(tripFixture.rentalOptions.date, "2026-08-17");
  assert.match(tripFixture.rentalOptions.pickup, /부산역/);
  assert.match(tripFixture.rentalOptions.returnPlan, /해운대/);
  const rentalProviders = tripFixture.rentalOptions.providers;
  assert.deepEqual(rentalProviders.map((provider) => provider.name), ["SK렌터카 부산역지점", "롯데렌터카 부산역지점"]);
  assert.equal(rentalProviders[0].address, "중앙대로180번길 12");
  assert.equal(rentalProviders[1].address, "중앙대로248번길 7-7");
  rentalProviders.forEach((provider) => assert.match(provider.url, /^https:\/\//));
  assert.match(tripFixture.rentalOptions.returnPlan, /예약.*확인/);
  assert.deepEqual(Object.keys(tripFixture.luggageTransfer).sort(), ["collection", "confirmed", "date", "destination", "name", "note", "origin", "url"]);
  assert.equal(tripFixture.luggageTransfer.date, "2026-08-19");
  assert.match(tripFixture.luggageTransfer.name, /짐캐리/);
  assert.match(tripFixture.luggageTransfer.origin, /파라다이스호텔/);
  assert.match(tripFixture.luggageTransfer.destination, /부산역 1층 미팅홀/);
  assert.match(tripFixture.luggageTransfer.collection, /부산역/);
  assert.match(tripFixture.luggageTransfer.url, /^https:\/\//);
  assert.equal(tripFixture.luggageTransfer.confirmed, false);

  const day19Titles = tripFixture.defaultBlocks["2026-08-19"].map((block) => block.title);
  ["파라다이스호텔 체크아웃", "파라다이스호텔 짐캐리 인계", "해운대 립 바비큐 레스토랑", "부산역 짐 수령", "탑승 버퍼"].forEach((expected) => {
    assert.ok(day19Titles.some((title) => title.includes(expected)), `19 Aug needs ${expected}`);
  });
  assert.ok(tripFixture.defaultBlocks["2026-08-19"].some((block) => block.time === "14:31" && block.title.includes("KTX")), "19 Aug needs the 14:31 KTX");
  assert.ok(!day19Titles.some((title) => title.includes("부산역 인근 점심")), "19 Aug must replace the Busan Station lunch");
  assert.deepEqual(tripFixture.routeSequences["2026-08-19"], expectedDay19Route);
  assert.deepEqual(tripFixture.mapRoutePoints["19일"].map((point) => point.name), expectedDay19Route);
  const day19MapPoints = tripFixture.mapRoutePoints["19일"];
  assert.deepEqual(day19MapPoints[1], { name: "파라다이스호텔 짐캐리 인계", lat: 35.1605, lng: 129.1635 });
  assert.deepEqual(day19MapPoints[3], { name: "부산역 짐캐리 수령·탑승 버퍼", lat: 35.1151, lng: 129.0414 });

  for (const mode of ["light", "balanced", "comfort"]) {
    const result = runTripOrchestrator({ ...tripFixture, budgetMode: mode });
    const selectedMeals = result.specialistOutputs.food.recommendations.flatMap((day) => day.slots.map((slot) => slot.primary));
    assert.equal(new Set(selectedMeals.map((meal) => meal.genre)).size, selectedMeals.length, `${mode} selected meal genres must be unique`);
    const labels = tripFixture.budgets[mode].items.map((item) => item.label);
    ["조식", "렌터카", "짐캐리"].forEach((label) => assert.ok(labels.includes(label), `${mode} budget needs ${label}`));
    for (const date of dates) {
      const breakfastSelection = tripFixture.mealSelections[mode][date].breakfast;
      const breakfastPriorities = tripFixture.mealPriorities[mode][date].breakfast;
      assert.ok(tripFixture.mealSlots[date].breakfast.some((candidate) => candidate.name === breakfastSelection), `${mode} ${date} breakfast selection must be a candidate`);
      assert.ok(Array.isArray(breakfastPriorities) && breakfastPriorities.length > 0, `${mode} ${date} needs breakfast priorities`);
      assert.equal(breakfastPriorities[0], breakfastSelection, `${mode} ${date} breakfast priority must lead with the selected candidate`);
    }
  }

  const recheckTitles = tripFixture.recheckSources.map((source) => source.title);
  ["SK렌터카", "롯데렌터카", "짐캐리", "해동용궁사", "해운대암소갈비집"].forEach((expected) => {
    assert.ok(recheckTitles.some((title) => title.includes(expected)), `recheck sources need ${expected}`);
  });
}

function testAppRendersMealSlotsAndConciseItineraryMeals() {
  assert.match(appSource, /day\.meals\.slots/);
  assert.match(appSource, /slot\.candidates\[0\]/);
  assert.match(appSource, /candidate\.genre/);
  assert.match(appSource, /candidate\.area/);
  assert.match(appSource, /candidate\.note/);
  assert.match(appSource, /safeExternalUrl\(candidate\.url\)/);
}

function testAppUsesReturnTransportInsteadOfDay19CimerCopy() {
  const result = runTripOrchestrator(tripFixture);
  const returnTransport = result.specialistOutputs.transport.recommendations.find((item) => item.date === "2026-08-19");
  const paradise = result.specialistOutputs.lodging.recommendations.find((item) => item.name === "파라다이스호텔 부산");

  assert.match(appSource, /specialistOutputs\.lodging\.recommendations/);
  assert.match(appSource, /specialistOutputs\.transport\.recommendations/);
  assert.doesNotMatch(appSource, /씨메르 이용 후 체크아웃/);
  assert.match(paradise.luggage, /짐캐리로 부산역에 짐 인계/);
  assert.doesNotMatch(paradise.luggage, /부산역 짐 보관/);
  assert.match(returnTransport.detail, /짐캐리.*인계/);
  assert.match(returnTransport.detail, /부산역.*수령/);
  assert.doesNotMatch(returnTransport.detail, /역내 짐 보관|부산역 짐 보관/);
  assert.match(returnTransport.detail, /13:45/);
  assert.match(returnTransport.detail, /14:31/);
}

function testVisibleTripCopyUsesZimCarryHandoffAndCollection() {
  const visibleCopy = [tripFixture.hero.summary, ...tripFixture.tripLens, ...tripFixture.photos.map((photo) => photo.detail)].join(" ");
  const day19MustDo = tripFixture.dayFlows.find((day) => day.date === "2026-08-19").mustDo;

  assert.match(visibleCopy, /짐캐리.*인계/);
  assert.match(visibleCopy, /부산역.*수령/);
  assert.doesNotMatch(visibleCopy, /부산역 짐 보관|역내 짐 보관/);
  assert.match(day19MustDo, /짐캐리.*인계/);
  assert.match(day19MustDo, /부산역.*수령/);
  assert.doesNotMatch(day19MustDo, /부산역 짐 보관|역내 짐 보관/);
}

function testAppLabelsBreakfastAndRendersRentalLogisticsLinks() {
  const result = runTripOrchestrator(tripFixture);
  const rentalTransport = result.specialistOutputs.transport.recommendations.find((item) => item.date === "2026-08-17");
  const luggageTransport = result.specialistOutputs.transport.recommendations.find((item) => item.date === "2026-08-19");

  assert.match(appSource, /function mealLabel\(meal\)[\s\S]*meal === "breakfast"[\s\S]*Breakfast/);
  assert.match(appSource, /safeExternalUrl\(provider\.url\)/);
  assert.match(appSource, /safeExternalUrl\(logistics\.url\)/);
  assert.match(appSource, /target="_blank" rel="noopener noreferrer"/);
  assert.match(appSource, /ops-card__links/);
  assert.ok(rentalTransport.providers.some((provider) => provider.name.includes("SK")), "17 Aug transport includes an SK rental provider");
  assert.ok(rentalTransport.providers.some((provider) => provider.name.includes("롯데")), "17 Aug transport includes a Lotte rental provider");
  assert.match(luggageTransport.title, /짐캐리/);
  assert.match(luggageTransport.detail, /짐캐리/);
  assert.doesNotMatch(luggageTransport.title, /부산역.*짐 보관/);
}

function renderOpsFixture() {
  const opsList = { innerHTML: "" };
  const sourceStart = appSource.indexOf("function escapeHtml(");
  const sourceEnd = appSource.indexOf("function renderRoutes()");

  assert.notEqual(sourceStart, -1);
  assert.notEqual(sourceEnd, -1);

  const context = {
    URL,
    window: { location: { href: "https://trip.example/" } },
    trip: { lodgings: [] },
    orchestration: {
      specialistOutputs: {
        lodging: { recommendations: [{ name: "Hotel handoff", dates: "8/17-8/19", role: "stay", luggage: "hotel luggage handoff" }] },
        transport: {
          recommendations: [
            { date: "2026-08-16", title: "Outbound KTX", detail: "07:58 departure" },
            {
              date: "2026-08-17",
              title: "Rental pickup",
              detail: "17 Aug rental pickup",
              providers: [
                { name: "Renamed SK provider", address: "SK address", note: "SK note", url: "https://sk.example/rental" },
                { name: "Renamed Lotte provider", address: "Lotte address", note: "Lotte note", url: "https://lotte.example/rental" }
              ]
            },
            {
              date: "2026-08-19",
              title: "Agent logistics",
              logistics: {
                name: "Renamed Carry provider",
                origin: "Paradise Hotel handoff",
                destination: "Busan Station meeting hall",
                collection: "Busan Station collection",
                note: "Confirm the Zim Carry handoff",
                url: "https://carry.example/booking",
                confirmed: false
              }
            },
            { date: "2026-08-19", title: "Return KTX", detail: "14:31 KTX" }
          ]
        }
      }
    },
    document: { getElementById: () => opsList }
  };

  vm.runInNewContext(appSource.slice(sourceStart, sourceEnd), context, { filename: "app.js" });
  context.renderOps();
  return opsList.innerHTML;
}

function testAppRendersOpsFromAgentProviderAndLogisticsData() {
  const html = renderOpsFixture();

  ["Renamed SK provider", "Renamed Lotte provider", "Renamed Carry provider"].forEach((name) => assert.match(html, new RegExp(name)));
  assert.match(html, /href="https:\/\/sk\.example\/rental" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /href="https:\/\/lotte\.example\/rental" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /href="https:\/\/carry\.example\/booking" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /Paradise Hotel handoff/);
  assert.match(html, /Busan Station collection/);
  assert.doesNotMatch(html, /부산역 짐 보관|역내 짐 보관/);
}

function testAppBuildsMapRoutesFromOrchestratedSequences() {
  assert.match(appSource, /orchestration\.days\.map\(\(day\) =>/);
  assert.match(appSource, /day\.route\.points/);
}

function testAppRendersOneDailyRequestControlAndOpenSlotState() {
  assert.match(appSource, /CUSTOM_REQUESTS_KEY/);
  assert.match(appSource, /data-custom-request-date/);
  assert.match(appSource, /customRequests/);
  assert.match(appSource, /day\.openSlot/);
  assert.match(appSource, /request-waiting/);
  assert.match(appSource, /request-used/);
  assert.match(appSource, /request-warning/);
  assert.match(appSource, /data-custom-request-area/);
  assert.match(appSource, /area: areaInput\.value\.trim\(\)/);
}

function testAppDistinguishesPrimaryMealsFromAlternatives() {
  assert.match(appSource, /slot\.primary/);
  assert.match(appSource, /slot\.alternatives/);
  assert.match(appSource, /대표 선택/);
  assert.match(appSource, /다른 선택지/);
}

/**
 * Render one date flow through the app's editor function in an isolated VM.
 * @returns {string}
 */
function renderFlowEditorFixture() {
  const editor = { innerHTML: "" };
  const sourceStart = appSource.indexOf("function escapeHtml(");
  const sourceEnd = appSource.indexOf("function saveFlowEditor()");

  assert.notEqual(sourceStart, -1);
  assert.notEqual(sourceEnd, -1);

  const context = {
    trip: {
      dayFlows: [{ date: "2026-08-16", label: "16일", intent: "시장 동선" }]
    },
    document: {
      getElementById(id) {
        return id === "day-flow-editor" ? editor : null;
      }
    },
    localStorage: {
      getItem() {
        return null;
      }
    }
  };

  vm.runInNewContext(appSource.slice(sourceStart, sourceEnd), context, { filename: "app.js" });
  context.renderFlowEditor();
  return editor.innerHTML;
}

function testAppGroupsFlowInputsByDateCard() {
  const html = renderFlowEditorFixture();

  assert.match(html, /^<section class="day-flow-card"[^>]*>[\s\S]*?<header class="day-flow-card__header">[\s\S]*?data-flow-date="2026-08-16"[\s\S]*?data-custom-request-date="2026-08-16"[\s\S]*?data-custom-request-area="2026-08-16"[\s\S]*?<\/section>$/);
}

try {
  testMalformedEncoding();
  testSiblingTraversal();
  testMealSlotsHaveDisplayableCandidateData();
  testCentumFixtureRemovesOsiriaDestinationCopy();
  testCentumFixtureDefinesDay18RouteAndOptionalExperiences();
  testMealFallbackFixtureProvidesFiveActionableAlternatives();
  testBreakfastRentalAndLuggageFixture();
  testAppRendersMealSlotsAndConciseItineraryMeals();
  testAppUsesReturnTransportInsteadOfDay19CimerCopy();
  testVisibleTripCopyUsesZimCarryHandoffAndCollection();
  testAppLabelsBreakfastAndRendersRentalLogisticsLinks();
  testAppRendersOpsFromAgentProviderAndLogisticsData();
  testAppBuildsMapRoutesFromOrchestratedSequences();
  testAppRendersOneDailyRequestControlAndOpenSlotState();
  testAppDistinguishesPrimaryMealsFromAlternatives();
  testAppGroupsFlowInputsByDateCard();
  process.stdout.write("qa-server tests passed\n");
} catch (error) {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
}
