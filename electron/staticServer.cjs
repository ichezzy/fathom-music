const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

/**
 * Serve a built single-page app from `root` over http on 127.0.0.1.
 *
 * The renderer needs a real http origin (not file://) so the YouTube IFrame
 * API's postMessage handshake works in the packaged app. Binds to loopback
 * only, serves GET/HEAD, and refuses any path that escapes `root`.
 *
 * Resolves to `{ url, close }`. Pass `{ port }` for a fixed port (needed so
 * the renderer origin — and thus IndexedDB — stays stable across launches);
 * port 0 lets the OS pick a free one.
 */
function startStaticServer(root, { port = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405);
        res.end("Method Not Allowed");
        return;
      }

      let pathname = "/";
      try {
        pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
      } catch {
        pathname = "/";
      }

      const rel = pathname.replace(/^\/+/, "");
      let filePath = path.join(root, rel);

      // Prevent path traversal outside the served root.
      const normalizedRoot = path.resolve(root);
      if (!path.resolve(filePath).startsWith(normalizedRoot)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      fs.stat(filePath, (err, stat) => {
        // Fall back to index.html for the SPA entry / unknown routes.
        if (err || stat.isDirectory()) {
          filePath = path.join(root, "index.html");
        }
        const ext = path.extname(filePath).toLowerCase();
        const type = MIME[ext] ?? "application/octet-stream";
        fs.readFile(filePath, (readErr, data) => {
          if (readErr) {
            res.writeHead(404);
            res.end("Not Found");
            return;
          }
          res.writeHead(200, { "Content-Type": type });
          res.end(req.method === "HEAD" ? undefined : data);
        });
      });
    });

    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      const boundPort =
        typeof address === "object" && address ? address.port : port;
      resolve({
        url: `http://127.0.0.1:${boundPort}/`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

module.exports = { startStaticServer };
