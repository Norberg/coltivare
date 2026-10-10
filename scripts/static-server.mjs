// Test/preview server only. It serves built files and never accepts user data.
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync, readFileSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
const root = resolve("dist");
const publicConfig = JSON.parse(
  readFileSync("src/supabase-config.json", "utf8"),
);
const cloudOrigin = new URL(process.env.VITE_SUPABASE_URL || publicConfig.url)
  .origin;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};
createServer((request, response) => {
  const pathname = decodeURIComponent(
    new URL(request.url, "http://localhost").pathname,
  );
  const file = resolve(
    root,
    "." + (pathname === "/" ? "/index.html" : pathname),
  );
  response.setHeader(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ${cloudOrigin}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
  );
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  if (
    !file.startsWith(root + sep) ||
    !existsSync(file) ||
    !statSync(file).isFile()
  ) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.setHeader(
    "Content-Type",
    mime[extname(file)] || "application/octet-stream",
  );
  response.setHeader("Cache-Control", "no-cache");
  createReadStream(file).pipe(response);
}).listen(4173, "127.0.0.1");
