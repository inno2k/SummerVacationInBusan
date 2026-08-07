const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const docsRoot = path.resolve(__dirname);
const serverSource = fs.readFileSync(path.join(docsRoot, "qa-server.js"), "utf8");

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

try {
  testMalformedEncoding();
  testSiblingTraversal();
  process.stdout.write("qa-server tests passed\n");
} catch (error) {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
}
