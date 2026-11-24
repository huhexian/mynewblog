#!/usr/bin/env node
/**
 * Seal password-protected posts in a built Hugo site (Node.js standard library only).
 *
 *   node themes/hugo-theme-icy/tools/protect/seal.mjs public
 *   node themes/hugo-theme-icy/tools/protect/seal.mjs public --dry-run
 *
 * For every page carrying the theme's build markers
 * (#icy-protected-build, #icy-protected-source):
 *   1. encrypt the content HTML and every file of the page bundle into
 *      protected-content.plb (PBKDF2-SHA-256 600k + AES-256-GCM, the page
 *      route bound as additional authenticated data);
 *   2. delete the plaintext files and replace the markers with a public
 *      config (#icy-protected-config);
 * then remove term pages (and their feeds) that list nothing but protected
 * posts, and refuse to finish if any remaining file still links to them.
 *
 * Run tools/protect/verify.mjs afterwards. Running seal twice is harmless:
 * sealed pages carry no markers and are skipped.
 */
import { createCipheriv, pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

export const PAYLOAD_NAME = "protected-content.plb";
export const MAGIC = Buffer.from("PLB1", "ascii");
export const BUILD_ID = "icy-protected-build";
export const SOURCE_ID = "icy-protected-source";
export const CONFIG_ID = "icy-protected-config";
export const TERM_MARKER = /<span\b[^>]*\bdata-icy-term-public\s*=\s*"?(\d+)"?[^>]*>\s*<\/span>/i;
const ITERATIONS = 600000;

const MIME = new Map(Object.entries({
  ".avif": "image/avif", ".bmp": "image/bmp", ".gif": "image/gif", ".ico": "image/x-icon",
  ".jpeg": "image/jpeg", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml",
  ".tif": "image/tiff", ".tiff": "image/tiff", ".webp": "image/webp",
  ".aac": "audio/aac", ".flac": "audio/flac", ".m4a": "audio/mp4", ".mp3": "audio/mpeg",
  ".oga": "audio/ogg", ".ogg": "audio/ogg", ".opus": "audio/ogg", ".wav": "audio/wav",
  ".m4v": "video/mp4", ".mov": "video/quicktime", ".mp4": "video/mp4", ".ogv": "video/ogg", ".webm": "video/webm",
  ".csv": "text/csv;charset=utf-8", ".json": "application/json", ".md": "text/markdown;charset=utf-8",
  ".pdf": "application/pdf", ".txt": "text/plain;charset=utf-8", ".xml": "application/xml",
  ".yaml": "text/yaml;charset=utf-8", ".yml": "text/yaml;charset=utf-8", ".zip": "application/zip",
}));

export const posix = (value) => value.split(path.sep).join("/");

export async function walk(directory) {
  const out = [];
  for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const target = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`symbolic links are not allowed in the output: ${target}`);
    if (entry.isDirectory()) out.push(...await walk(target));
    else if (entry.isFile()) out.push(target);
  }
  return out;
}

export function routeToDirectory(site, route) {
  if (typeof route !== "string" || !route.startsWith("/") || !route.endsWith("/")) {
    throw new Error(`route must be an absolute directory URL: ${route}`);
  }
  const segments = route.slice(1, -1).split("/").filter(Boolean).map((segment) => {
    const decoded = decodeURIComponent(segment);
    if (!decoded || decoded === "." || decoded === ".." || /[\\/]/.test(decoded)) throw new Error(`unsafe route segment in ${route}`);
    return decoded;
  });
  const directory = path.resolve(site, ...segments);
  if (directory !== site && !directory.startsWith(site + path.sep)) throw new Error(`route escapes the site: ${route}`);
  return directory;
}

function scriptBlock(html, id) {
  const re = new RegExp(`<script\\b[^>]*\\bid\\s*=\\s*"?${id}"?[^>]*>([\\s\\S]*?)<\\/script>`, "i");
  return html.match(re);
}

function decodeBase64(value, label) {
  const clean = value.replace(/\s+/g, "");
  if (!clean || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new Error(`invalid ${label} marker`);
  return Buffer.from(clean, "base64").toString("utf8");
}

function readMarkers(html) {
  const build = scriptBlock(html, BUILD_ID);
  const source = scriptBlock(html, SOURCE_ID);
  if (!build && !source) return null;
  if (!build || !source) throw new Error("incomplete protected build markers");
  const config = JSON.parse(decodeBase64(build[1], "build"));
  if (config?.version !== 1 || typeof config.password !== "string" || !config.password
    || typeof config.route !== "string" || !Array.isArray(config.termRoutes)) {
    throw new Error("invalid protected build config");
  }
  return { config, source: decodeBase64(source[1], "source"), buildMarkup: build[0], sourceMarkup: source[0] };
}

function encrypt({ html, files, password, route }) {
  const htmlBytes = Buffer.from(html, "utf8");
  let offset = htmlBytes.length;
  const descriptors = files.map((f) => {
    const d = { url: f.url, name: f.name, mime: f.mime, offset, length: f.bytes.length };
    offset += f.bytes.length;
    return d;
  });
  const manifest = Buffer.from(JSON.stringify({ version: 1, html: { offset: 0, length: htmlBytes.length }, files: descriptors }), "utf8");
  const manifestLength = Buffer.alloc(4);
  manifestLength.writeUInt32BE(manifest.length);
  const plaintext = Buffer.concat([manifestLength, manifest, htmlBytes, ...files.map((f) => f.bytes)]);

  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(`hugo-protected:v1:${route}`, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  key.fill(0);

  const header = Buffer.from(JSON.stringify({
    version: 1, kdf: "PBKDF2-SHA-256", iterations: ITERATIONS,
    salt: salt.toString("base64"), iv: iv.toString("base64"), route,
  }), "utf8");
  const headerLength = Buffer.alloc(4);
  headerLength.writeUInt32BE(header.length);
  return Buffer.concat([MAGIC, headerLength, header, ciphertext]);
}

async function writeAtomic(target, value) {
  const temp = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`);
  await fs.writeFile(temp, value, { flag: "wx" });
  await fs.rename(temp, target);
}

async function removeEmptyDirs(directory, boundary) {
  if (directory === boundary) return;
  if ((await fs.readdir(directory)).length === 0) {
    await fs.rmdir(directory);
    await removeEmptyDirs(path.dirname(directory), boundary);
  }
}

const isText = (file) => [".css", ".html", ".js", ".json", ".txt", ".xml", ".webmanifest"].includes(path.extname(file).toLowerCase());

export async function seal(siteDirectory, { dryRun = false } = {}) {
  const site = path.resolve(siteDirectory);
  if (!(await fs.stat(site)).isDirectory()) throw new Error(`not a directory: ${site}`);
  const pages = [];
  for (const file of (await walk(site)).filter((f) => path.basename(f) === "index.html")) {
    const markers = readMarkers(await fs.readFile(file, "utf8"));
    if (markers) pages.push({ file, markers });
  }

  // Every file in a protected page's directory, by URL. On a multilingual site
  // Hugo publishes a bundle's resources once, under the first language's
  // route, and the translations link there: a translation's payload must
  // carry the files its content references from the other directories too.
  const owned = new Map();
  for (const page of pages) {
    const { route } = page.markers.config;
    const directory = routeToDirectory(site, route);
    if (path.resolve(page.file) !== path.join(directory, "index.html")) throw new Error(`route ${route} does not match ${page.file}`);
    page.directory = directory;
    page.own = [];
    for (const resource of await walk(directory)) {
      const name = posix(path.relative(directory, resource));
      if (name === "index.html") continue;
      if (name === PAYLOAD_NAME) throw new Error(`${route}: ${PAYLOAD_NAME} already exists next to unsealed markers`);
      if (name.endsWith("/index.html")) {
        throw new Error(`${route}: protected pages must be leaf bundles (found a nested page at ${name})`);
      }
      const entry = {
        file: resource, name, directory,
        url: route + name.split("/").map(encodeURIComponent).join("/"),
        mime: MIME.get(path.extname(resource).toLowerCase()) ?? "application/octet-stream",
        bytes: await fs.readFile(resource),
      };
      page.own.push(entry);
      owned.set(entry.url, entry);
    }
  }
  const references = (text, url) => text.includes(url) || text.includes(decodeURI(url));

  // A public page using one of those files would break once the plaintext is
  // gone (e.g. only one translation is protected): refuse instead.
  const protectedIndexes = new Set(pages.map((p) => p.file));
  if (owned.size) {
    for (const file of (await walk(site)).filter((f) => path.basename(f) === "index.html" && !protectedIndexes.has(f))) {
      const text = await fs.readFile(file, "utf8");
      for (const url of owned.keys()) {
        if (references(text, url)) {
          throw new Error(`public page ${posix(path.relative(site, file))} uses ${decodeURI(url)}, a file of a protected page `
            + "(protect every translation of the page, or none)");
        }
      }
    }
  }

  // Encrypt every page before deleting any plaintext: translations share files.
  const sealed = [];
  for (const page of pages) {
    const { file, markers, directory } = page;
    const { route, password } = markers.config;
    const files = [...page.own];
    for (const entry of owned.values()) {
      if (entry.directory !== directory && references(markers.source, entry.url)) files.push(entry);
    }
    const payload = encrypt({ html: markers.source, files, password, route });
    const config = JSON.stringify({ version: 1, payload: PAYLOAD_NAME }).replace(/</g, "\\u003c");
    const html = (await fs.readFile(file, "utf8"))
      .replace(markers.sourceMarkup, "")
      .replace(markers.buildMarkup, `<script id="${CONFIG_ID}" type="application/json">${config}</script>`);
    if (html.includes(BUILD_ID) || html.includes(SOURCE_ID)) throw new Error(`${route}: plaintext markers remain`);

    if (!dryRun) {
      await writeAtomic(path.join(directory, PAYLOAD_NAME), payload);
      await writeAtomic(file, html);
    }
    sealed.push({ route, files: files.length, shared: files.length - page.own.length, bytes: payload.length, termRoutes: markers.config.termRoutes });
  }
  if (!dryRun) {
    for (const entry of owned.values()) {
      await fs.rm(entry.file);
      await removeEmptyDirs(path.dirname(entry.file), entry.directory);
    }
  }

  // Term pages that list only protected posts reveal private tags: remove them.
  const removed = [];
  for (const route of new Set(sealed.flatMap((p) => p.termRoutes))) {
    const directory = routeToDirectory(site, route);
    const index = path.join(directory, "index.html");
    let html;
    try {
      html = await fs.readFile(index, "utf8");
    } catch {
      continue; // already removed by an earlier run
    }
    const marker = html.match(TERM_MARKER);
    if (!marker) throw new Error(`term page ${route} lacks its public-count marker (theme templates out of date?)`);
    if (Number(marker[1]) === 0) {
      if (!dryRun) await fs.rm(directory, { recursive: true });
      removed.push(route);
    } else if (!dryRun) {
      await writeAtomic(index, html.replace(marker[0], ""));
    }
  }
  if (removed.length && !dryRun) {
    for (const file of (await walk(site)).filter(isText)) {
      const text = await fs.readFile(file, "utf8");
      for (const route of removed) {
        if (text.includes(`"${route}"`) || text.includes(`>${route}<`) || text.includes(`${route}"`)) {
          throw new Error(`removed private term ${route} is still referenced in ${posix(path.relative(site, file))}`);
        }
      }
    }
  }
  return { site, dryRun, sealed: sealed.map(({ termRoutes, ...p }) => p), removedTerms: removed };
}

if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(posix(process.argv[1] ?? ""))) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const site = args.find((a) => !a.startsWith("--"));
  if (!site) {
    console.error("usage: node tools/protect/seal.mjs SITE_DIRECTORY [--dry-run]");
    process.exit(64);
  }
  seal(site, { dryRun })
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error(`seal failed: ${error.message}`);
      process.exitCode = 1;
    });
}
