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
  assert.match(appSource, /day\.route\.sequence\.map/);
}

function testAppRendersOneDailyRequestControlAndOpenSlotState() {
  assert.match(appSource, /CUSTOM_REQUESTS_KEY/);
  assert.match(appSource, /data-custom-request-date/);
  assert.match(appSource, /customRequests/);
  assert.match(appSource, /day\.openSlot/);
  assert.match(appSource, /request-waiting/);
  assert.match(appSource, /request-used/);
  assert.match(appSource, /request-warning/);
}

function testAppDistinguishesPrimaryMealsFromAlternatives() {
  assert.match(appSource, /slot\.primary/);
  assert.match(appSource, /slot\.alternatives/);
  assert.match(appSource, /대표 선택/);
  assert.match(appSource, /다른 선택지/);
}

try {
  testMalformedEncoding();
  testSiblingTraversal();
  testMealSlotsHaveDisplayableCandidateData();
  testAppRendersMealSlotsAndConciseItineraryMeals();
  testAppUsesReturnTransportInsteadOfDay19CimerCopy();
  testAppBuildsMapRoutesFromOrchestratedSequences();
  testAppRendersOneDailyRequestControlAndOpenSlotState();
  testAppDistinguishesPrimaryMealsFromAlternatives();
  process.stdout.write("qa-server tests passed\n");
} catch (error) {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
}
