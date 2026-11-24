#!/usr/bin/env node
/**
 * Verify a sealed site before deploying (Node.js standard library only).
 *
 *   node themes/hugo-theme-icy/tools/protect/verify.mjs public
 *
 * Fails (exit code 1) when:
 *   - any page still carries build-time markers (unsealed plaintext);
 *   - a protected page directory holds anything but index.html and the payload;
 *   - a payload is malformed or bound to a different route;
 *   - a protected route appears in a non-HTML output (sitemap, feeds, search
 *     index, manifest…) — HTML listings may show titles on purpose.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { BUILD_ID, CONFIG_ID, MAGIC, PAYLOAD_NAME, SOURCE_ID, posix, walk } from "./seal.mjs";

export async function verify(siteDirectory) {
  const site = path.resolve(siteDirectory);
  const files = await walk(site);
  const errors = [];
  const pages = [];

  for (const file of files.filter((f) => path.basename(f) === "index.html")) {
    const html = await fs.readFile(file, "utf8");
    const rel = posix(path.relative(site, file));
    if (html.includes(BUILD_ID) || html.includes(SOURCE_ID)) errors.push(`${rel}: unsealed protected content (build markers present)`);
    const config = html.match(new RegExp(`<script\\b[^>]*\\bid\\s*=\\s*"?${CONFIG_ID}"?[^>]*>([\\s\\S]*?)</script>`, "i"));
    if (!config) continue;
    let parsed = null;
    try { parsed = JSON.parse(config[1]); } catch { /* reported below */ }
    if (parsed?.version !== 1 || parsed.payload !== PAYLOAD_NAME) {
      errors.push(`${rel}: invalid protected config`);
      continue;
    }
    const dir = path.dirname(file);
    const segments = posix(path.relative(site, dir)).split("/").filter(Boolean);
    pages.push({ dir, rel, route: `/${segments.map(encodeURIComponent).join("/")}${segments.length ? "/" : ""}` });
  }

  for (const page of pages) {
    const names = (await walk(page.dir)).map((f) => posix(path.relative(page.dir, f))).sort();
    if (names.join("|") !== ["index.html", PAYLOAD_NAME].join("|")) {
      errors.push(`${page.rel}: plaintext files left next to the payload: ${names.filter((n) => n !== "index.html" && n !== PAYLOAD_NAME).join(", ")}`);
    }
    try {
      const bytes = await fs.readFile(path.join(page.dir, PAYLOAD_NAME));
      if (!bytes.subarray(0, 4).equals(MAGIC)) throw new Error("bad magic");
      const length = bytes.readUInt32BE(4);
      const header = JSON.parse(bytes.subarray(8, 8 + length).toString("utf8"));
      const same = decodeURI(header.route) === decodeURI(page.route);
      if (header.version !== 1 || header.kdf !== "PBKDF2-SHA-256" || !(header.iterations >= 100000) || !same) {
        throw new Error(`header does not match the page (route ${header.route})`);
      }
    } catch (error) {
      errors.push(`${page.rel}: payload ${error.message}`);
    }
  }

  const routes = pages.map((p) => p.route);
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (![".xml", ".json", ".txt", ".js", ".css", ".webmanifest"].includes(ext)) continue;
    const text = await fs.readFile(file, "utf8");
    for (const route of routes) {
      if (text.includes(route) || text.includes(decodeURI(route))) {
        errors.push(`${posix(path.relative(site, file))}: mentions protected route ${decodeURI(route)}`);
      }
    }
  }
  return { site, protectedPages: routes.map((r) => decodeURI(r)), errors };
}

const args = process.argv.slice(2);
if (args.length === 1) {
  verify(args[0]).then((report) => {
    console.log(JSON.stringify({ site: report.site, protectedPages: report.protectedPages }, null, 2));
    for (const error of report.errors) console.error(`ERROR ${error}`);
    if (report.errors.length) process.exitCode = 1;
    else console.log("OK: protected output verified");
  }).catch((error) => {
    console.error(`verify failed: ${error.message}`);
    process.exitCode = 1;
  });
} else {
  console.error("usage: node tools/protect/verify.mjs SITE_DIRECTORY");
  process.exit(64);
}
