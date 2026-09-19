#!/usr/bin/env node
/* Tiny static server for local development (no dependencies).
   Mirrors how Vercel serves the site: directory -> index.html, trailing-slash
   redirects, and 404.html for anything missing.   Usage: node tools/serve.mjs [port] */
import { createServer } from "node:http";
import { stat, readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.argv[2] || process.env.PORT || 8000);
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2", ".woff": "font/woff", ".webmanifest": "application/manifest+json",
};

const send = async (res, file, status = 200) => {
  const body = await readFile(file);
  res.writeHead(status, { "Content-Type": types[extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
  res.end(body);
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURIComponent(url.pathname);
    const file = normalize(join(root, pathname));
    if (!file.startsWith(root)) { res.writeHead(403); return res.end("forbidden"); }
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      if (!pathname.endsWith("/")) { res.writeHead(301, { Location: pathname + "/" + url.search }); return res.end(); }
      const index = join(file, "index.html");
      info = await stat(index).catch(() => null);
      if (info?.isFile()) return send(res, index);
    } else if (info?.isFile()) {
      return send(res, file);
    }
    const nf = join(root, "404.html");
    if (await stat(nf).catch(() => null)) return send(res, nf, 404);
    res.writeHead(404); res.end("not found");
  } catch (err) {
    res.writeHead(500); res.end(String(err));
  }
}).listen(port, () => console.log(`sciolyutils → http://localhost:${port}`));
