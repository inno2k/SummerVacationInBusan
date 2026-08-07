const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname);
const port = 4173;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp"
};

/**
 * Decode the request pathname while rejecting malformed escape sequences.
 * @param {string | undefined} url
 * @returns {{ ok: true, requestPath: string } | { ok: false }}
 */
function parseRequestPath(url) {
  const rawPath = (url || "/").split("?")[0];

  try {
    return {
      ok: true,
      requestPath: decodeURIComponent(rawPath)
    };
  } catch {
    return { ok: false };
  }
}

/**
 * Resolve a request path against the docs root and report whether it stays inside.
 * @param {string} rootDir
 * @param {string} requestPath
 * @returns {{ filePath: string, insideRoot: boolean }}
 */
function resolveRequestFile(rootDir, requestPath) {
  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const filePath = path.resolve(rootDir, relativePath);
  const relativeToRoot = path.relative(rootDir, filePath);
  const insideRoot =
    relativeToRoot === "" || (!relativeToRoot.startsWith("..") && !path.isAbsolute(relativeToRoot));

  return {
    filePath,
    insideRoot
  };
}

const server = http.createServer((req, res) => {
  const parsedPath = parseRequestPath(req.url);

  if (!parsedPath.ok) {
    res.writeHead(400);
    res.end("Bad Request");
    return;
  }

  const { filePath, insideRoot } = resolveRequestFile(root, parsedPath.requestPath);

  if (!insideRoot) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

server.listen(port, "127.0.0.1");
