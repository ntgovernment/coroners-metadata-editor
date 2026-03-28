import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";

// URL-encode the main HTML filename (the apostrophe is U+2019, %E2%80%99 in UTF-8)
const MAIN_HTML =
  "/Document%20metadata%20editor%20-%20new%20_%20Attorney-General%E2%80%99s%20Department.html";

/** Minimal MIME lookup — only the types present in _files/ */
const MIME = {
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".ico": "image/x-icon",
};

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext) return MIME[ext] ?? "application/octet-stream";
  // Extensionless files (e.g. the saved Google-Fonts `css` file): sniff header
  try {
    const buf = Buffer.alloc(64);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buf, 0, 64, 0);
    fs.closeSync(fd);
    const head = buf.toString("utf8").trimStart();
    if (head.startsWith("<")) return "text/html; charset=utf-8";
    if (head.startsWith("{") || head.startsWith("[")) return "application/json";
    // CSS comment / at-rule / selector are all plausible here
    return "text/css; charset=utf-8";
  } catch {
    return "text/css; charset=utf-8";
  }
}

export default defineConfig({
  root: ".",

  plugins: [
    /**
     * 1. Inject src/editor.css for CSS HMR.
     * 2. Serve _files/ directly (raw bytes, no Vite pipeline) to avoid
     *    PostCSS / import-analysis errors on the pre-built vendor files.
     * 3. Redirect / → the main HTML file.
     * 4. Trigger a full-reload when any src/*.js changes.
     */
    {
      name: "dev-server-setup",

      transformIndexHtml(html) {
        return html.replace(
          "</head>",
          '    <link rel="stylesheet" href="/src/editor.css">\n</head>',
        );
      },

      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = decodeURIComponent((req.url ?? "/").split("?")[0]);

          // Redirect bare root to the main HTML page
          if (url === "/") {
            res.writeHead(302, { Location: MAIN_HTML });
            res.end();
            return;
          }

          // Bypass Vite's transform pipeline for all pre-built vendor assets
          if (url.includes("_files/")) {
            const absPath = path.join(server.config.root, url);
            try {
              if (fs.statSync(absPath).isFile()) {
                res.setHeader("Content-Type", mimeFor(absPath));
                res.setHeader("Cache-Control", "no-cache");
                fs.createReadStream(absPath).pipe(res);
                return;
              }
            } catch {
              /* fall through */
            }
          }

          // Bypass Vite's transform pipeline for vendor libraries in src/
          if (
            url.startsWith("/src/") &&
            url !== "/src/editor.js" &&
            url !== "/src/editor.css"
          ) {
            const absPath = path.join(server.config.root, url);
            try {
              if (fs.statSync(absPath).isFile()) {
                res.setHeader("Content-Type", mimeFor(absPath));
                res.setHeader("Cache-Control", "no-cache");
                fs.createReadStream(absPath).pipe(res);
                return;
              }
            } catch {
              /* fall through */
            }
          }

          next();
        });

        // Full-reload when src/editor.js (or any other src JS) is saved
        server.watcher.add("src/**/*.js");
        server.watcher.on("change", (file) => {
          if (/[\\/]src[\\/].*\.js$/.test(file)) {
            server.ws.send({ type: "full-reload" });
          }
        });
      },
    },
  ],

  server: {
    open: MAIN_HTML,
  },
});
