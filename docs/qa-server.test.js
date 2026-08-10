const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { runTripOrchestrator } = require("./assets/js/trip-agents.js");

const docsRoot = path.resolve(__dirname);
const serverSource = fs.readFileSync(path.join(docsRoot, "qa-server.js"), "utf8");
const appSource = fs.readFileSync(path.join(docsRoot, "assets", "js", "app.js"), "utf8");
const tripFixture = JSON.parse(fs.readFileSync(path.join(docsRoot, "assets", "data", "busan-family-trip-2026.json"), "utf8"));

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

  for (const date of dates) {
    assert.ok(tripFixture.mealSlots[date].breakfast, `${date} needs a breakfast slot`);
    assert.ok(tripFixture.mealSlots[date].breakfast.length >= 3, `${date} breakfast needs three candidates`);
  }

  const day17Titles = tripFixture.defaultBlocks["2026-08-17"].map((block) => block.title);
  ["아스티호텔 체크아웃", "렌터카 수령", "파라다이스호텔 부산 짐 전달", "해동용궁사", "미포주차장", "블루라인파크", "파라다이스호텔 물놀이", "해운대해수욕장", "해운대 렌터카 반납"].forEach((expected) => {
    assert.ok(day17Titles.some((title) => title.includes(expected)), `17 Aug needs ${expected}`);
  });
  assert.deepEqual(tripFixture.routeSequences["2026-08-17"], expectedDay17Route);
  assert.deepEqual(tripFixture.mapRoutePoints["17일"].map((point) => point.name), expectedDay17Route);

  const rentalProviders = tripFixture.rentalCar.providers;
  assert.deepEqual(rentalProviders.map((provider) => provider.name), ["SK렌터카 부산역지점", "롯데렌터카 부산역지점"]);
  assert.equal(rentalProviders[0].address, "중앙대로180번길 12");
  assert.equal(rentalProviders[1].address, "중앙대로248번길 7-7");
  rentalProviders.forEach((provider) => assert.match(provider.url, /^https:\/\//));
  assert.match(tripFixture.rentalCar.returnNote, /해운대/);
  assert.match(tripFixture.rentalCar.returnNote, /예약.*확인/);

  const day19Titles = tripFixture.defaultBlocks["2026-08-19"].map((block) => block.title);
  ["파라다이스호텔 체크아웃", "짐캐리", "부산역 1층", "해운대 립 바비큐 레스토랑", "부산역 짐 수령", "탑승 버퍼"].forEach((expected) => {
    assert.ok(day19Titles.some((title) => title.includes(expected)), `19 Aug needs ${expected}`);
  });
  assert.ok(tripFixture.defaultBlocks["2026-08-19"].some((block) => block.time === "14:31" && block.title.includes("KTX")), "19 Aug needs the 14:31 KTX");
  assert.ok(!day19Titles.some((title) => title.includes("부산역 인근 점심")), "19 Aug must replace the Busan Station lunch");

  for (const mode of ["light", "balanced", "comfort"]) {
    const result = runTripOrchestrator({ ...tripFixture, budgetMode: mode });
    const selectedMeals = result.specialistOutputs.food.recommendations.flatMap((day) => day.slots.map((slot) => slot.primary));
    assert.equal(new Set(selectedMeals.map((meal) => meal.genre)).size, selectedMeals.length, `${mode} selected meal genres must be unique`);
    const labels = tripFixture.budgets[mode].items.map((item) => item.label);
    ["조식", "렌터카", "짐캐리"].forEach((label) => assert.ok(labels.includes(label), `${mode} budget needs ${label}`));
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
  assert.match(paradise.luggage, /부산역 짐 보관/);
  assert.match(returnTransport.detail, /역내 짐 보관/);
  assert.match(returnTransport.detail, /13:45/);
  assert.match(returnTransport.detail, /14:31/);
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
  testBreakfastRentalAndLuggageFixture();
  testAppRendersMealSlotsAndConciseItineraryMeals();
  testAppUsesReturnTransportInsteadOfDay19CimerCopy();
  testAppBuildsMapRoutesFromOrchestratedSequences();
  testAppRendersOneDailyRequestControlAndOpenSlotState();
  testAppDistinguishesPrimaryMealsFromAlternatives();
  testAppGroupsFlowInputsByDateCard();
  process.stdout.write("qa-server tests passed\n");
} catch (error) {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
}
