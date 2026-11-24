#!/usr/bin/env node
/**
 * Preview a site with sealed protected posts (Node.js standard library only;
 * needs `hugo` on PATH unless --no-build).
 *
 *   node themes/hugo-theme-icy/tools/protect/preview.mjs                 # build, seal, verify, serve
 *   node themes/hugo-theme-icy/tools/protect/preview.mjs --drafts        # include drafts and future posts
 *   node themes/hugo-theme-icy/tools/protect/preview.mjs --build-only    # stop after verify
 *   node themes/hugo-theme-icy/tools/protect/preview.mjs --no-build      # serve an existing sealed output
 *
 * Options: --site DIR (default: current directory), --destination DIR
 * (default: <site>/public), --port N (default: 1313), --host H (default: 127.0.0.1).
 *
 * `hugo server` shows protected posts with plaintext build markers, so the
 * unlock flow can only be tested on sealed output. This runs the same steps as
 * a deployment (production build, seal.mjs, verify.mjs) and serves the result
 * like a static file server would: index.html for directories, 404.html with
 * status 404, and HTTP Range requests so audio and video can seek.
 */
import { spawnSync } from "node:child_process";
import { createReadStream, promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".woff2": "font/woff2",
  ".plb": "application/octet-stream",
};

function parseArgs(argv) {
  const opts = { site: process.cwd(), destination: "", port: 1313, host: "127.0.0.1", drafts: false, build: true, serve: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) usage(`${arg} needs a value`);
      return argv[++i];
    };
    if (arg === "--site") opts.site = value();
    else if (arg === "--destination") opts.destination = value();
    else if (arg === "--port") opts.port = Number(value());
    else if (arg === "--host") opts.host = value();
    else if (arg === "--drafts") opts.drafts = true;
    else if (arg === "--build-only") opts.serve = false;
    else if (arg === "--no-build") opts.build = false;
    else if (arg === "-h" || arg === "--help") usage();
    else usage(`unknown option: ${arg}`);
  }
  if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) usage("--port must be an integer between 1 and 65535");
  opts.site = path.resolve(opts.site);
  opts.destination = path.resolve(opts.site, opts.destination || "public");
  return opts;
}

function usage(error) {
  const text = "usage: node tools/protect/preview.mjs [--site DIR] [--destination DIR] [--drafts] [--build-only | --no-build] [--port N] [--host H]";
  if (error) {
    console.error(`${error}\n${text}`);
    process.exit(64);
  }
  console.log(text);
  process.exit(0);
}

function run(command, args, cwd) {
  console.log(`> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: false });
  if (result.error) throw new Error(`${command}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} exited with code ${result.status}`);
}

async function build(opts) {
  if (opts.destination === opts.site || !opts.destination.startsWith(opts.site + path.sep)) {
    // --cleanDestinationDir deletes files: only allow a directory inside the site.
    throw new Error(`refusing to build outside the site directory: ${opts.destination}`);
  }
  const args = ["--minify", "--cleanDestinationDir", "--environment", "production", "--source", opts.site, "--destination", opts.destination];
  if (opts.drafts) args.push("--buildDrafts", "--buildFuture");
  run("hugo", args, opts.site);
  run(process.execPath, [path.join(here, "seal.mjs"), opts.destination], opts.site);
  run(process.execPath, [path.join(here, "verify.mjs"), opts.destination], opts.site);
}

async function resolveFile(root, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null;
  }
  const file = path.resolve(root, "." + path.posix.normalize("/" + decoded));
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  try {
    const stat = await fs.stat(file);
    if (stat.isFile()) return { file, stat };
    if (stat.isDirectory()) {
      const index = path.join(file, "index.html");
      const indexStat = await fs.stat(index).catch(() => null);
      if (indexStat?.isFile()) return { file: index, stat: indexStat, directory: !decoded.endsWith("/") };
    }
  } catch {
    // fall through
  }
  return null;
}

function serve(opts) {
  const root = opts.destination;
  const server = http.createServer(async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const url = req.url || "/";
    let found = await resolveFile(root, url);
    if (found?.directory) {
      const [pathname, query] = url.split("?");
      res.writeHead(301, { Location: pathname + "/" + (query ? `?${query}` : "") }).end();
      return;
    }
    let status = 200;
    if (!found) {
      status = 404;
      found = await resolveFile(root, "/404.html");
      if (!found) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("404 Not Found");
        return;
      }
    }
    const { file, stat } = found;
    const headers = {
      "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
    };
    let start = 0;
    let end = stat.size - 1;
    const range = status === 200 && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (range && (range[1] || range[2])) {
      if (range[1]) {
        start = Number(range[1]);
        if (range[2]) end = Math.min(Number(range[2]), end);
      } else {
        start = Math.max(0, stat.size - Number(range[2]));
      }
      if (start > end || start >= stat.size) {
        res.writeHead(416, { "Content-Range": `bytes */${stat.size}` }).end();
        return;
      }
      status = 206;
      headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
    }
    headers["Content-Length"] = String(end - start + 1);
    res.writeHead(status, headers);
    if (req.method === "HEAD" || stat.size === 0) {
      res.end();
      return;
    }
    createReadStream(file, { start, end }).pipe(res);
  });
  server.listen(opts.port, opts.host, () => {
    console.log(`Serving ${root}\nOpen http://${opts.host}:${opts.port}/ (Ctrl+C to stop)`);
  });
}

const opts = parseArgs(process.argv.slice(2));
try {
  if (opts.build) await build(opts);
  else if (!(await fs.stat(opts.destination).catch(() => null))?.isDirectory()) {
    throw new Error(`no built site at ${opts.destination}`);
  }
  if (opts.serve) serve(opts);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
