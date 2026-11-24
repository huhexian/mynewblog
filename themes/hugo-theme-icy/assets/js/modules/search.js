/**
 * Local full-text search — no third-party code, no external service.
 *
 * Two fingerprinted indexes built by Hugo (layouts/_partials/func/search-index.html):
 *   meta     titles, summaries, tags, dates, URLs — loaded immediately
 *   content  plain text of every entry — loaded at low priority when idle
 *            (or as soon as someone types)
 *
 * Matching: NFKC-normalised, case-insensitive substring search, so CJK text
 * needs no word segmentation. Every term must match somewhere; title, tag,
 * summary and body hits are weighted; ties go to newer entries. The body scan
 * runs in chunks and yields to the main thread; a newer query cancels an
 * older one. Results are built with DOM APIs only (no HTML strings).
 */
const DEBOUNCE_MS = 120;
const CHUNK = 200;
const SNIPPET_RADIUS = 60;
const WEIGHT = { title: 10, tag: 6, summary: 3, body: 1 };

const normalize = (text) => (text ?? "").normalize("NFKC").toLowerCase();
const yieldToMain = () =>
  globalThis.scheduler?.yield ? globalThis.scheduler.yield() : new Promise((r) => setTimeout(r, 0));

async function fetchJSON(url, integrity, priority) {
  const response = await fetch(url, { integrity: integrity || undefined, priority });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

export function initSearch() {
  const form = document.querySelector("form[data-search]");
  if (!form) return;
  const input = form.querySelector('input[type="search"]');
  const status = document.querySelector(".search-status");
  const list = document.querySelector(".search-results");
  const text = form.dataset;
  const max = Number(text.max) || 20;

  let entries = null; // [{ title, url, date, tags, summary, n: {title, tags, summary}, body, nBody }]
  let contentState = "idle"; // idle | loading | ready | failed
  let generation = 0;
  let timer = 0;

  const setStatus = (message) => { status.textContent = message; };

  // ---- Index loading ----
  const metaReady = fetchJSON(text.meta, text.metaIntegrity, "high").then((meta) => {
    entries = meta.map((m) => ({
      title: m.t, url: m.u, date: m.d, tags: m.g ?? [], summary: m.s ?? "",
      n: { title: normalize(m.t), tags: (m.g ?? []).map(normalize), summary: normalize(m.s) },
      body: "", nBody: "",
    }));
  });

  const loadContent = () => {
    if (contentState !== "idle") return;
    contentState = "loading";
    metaReady
      .then(() => fetchJSON(text.content, text.contentIntegrity, "low"))
      .then((bodies) => {
        bodies.forEach((body, i) => {
          if (entries[i]) {
            entries[i].body = body;
            entries[i].nBody = normalize(body);
          }
        });
        contentState = "ready";
        if (input.value.trim()) run(input.value);
      })
      .catch(() => { contentState = "failed"; });
  };
  ("requestIdleCallback" in window ? requestIdleCallback : (cb) => setTimeout(cb, 1500))(loadContent);

  // ---- Matching ----
  async function search(query, gen) {
    const terms = [...new Set(normalize(query).split(/\s+/).filter(Boolean))];
    if (!terms.length) return [];
    const phrase = normalize(query).trim();
    const hits = [];
    for (let start = 0; start < entries.length; start += CHUNK) {
      for (const entry of entries.slice(start, start + CHUNK)) {
        let score = 0;
        let all = true;
        for (const term of terms) {
          const inTitle = entry.n.title.includes(term);
          const inTag = entry.n.tags.some((t) => t.includes(term));
          const inSummary = entry.n.summary.includes(term);
          const inBody = entry.nBody.includes(term);
          if (!(inTitle || inTag || inSummary || inBody)) { all = false; break; }
          score += (inTitle ? WEIGHT.title : 0) + (inTag ? WEIGHT.tag : 0)
            + (inSummary ? WEIGHT.summary : 0) + (inBody ? WEIGHT.body : 0);
        }
        if (!all) continue;
        if (terms.length > 1 && entry.n.title.includes(phrase)) score += WEIGHT.title;
        hits.push({ entry, score });
      }
      await yieldToMain();
      if (gen !== generation) return null; // superseded
    }
    hits.sort((a, b) => b.score - a.score || (b.entry.date > a.entry.date ? 1 : b.entry.date < a.entry.date ? -1 : 0));
    return { hits: hits.slice(0, max), total: hits.length, terms };
  }

  // ---- Rendering (DOM only) ----
  const highlight = (target, source, terms) => {
    const lower = source.toLowerCase();
    const ranges = [];
    for (const term of terms) {
      if (!term) continue;
      for (let at = lower.indexOf(term); at !== -1; at = lower.indexOf(term, at + term.length)) {
        ranges.push([at, at + term.length]);
      }
    }
    ranges.sort((a, b) => a[0] - b[0]);
    let cursor = 0;
    for (const [s, e] of ranges) {
      if (s < cursor) continue;
      target.append(source.slice(cursor, s));
      const mark = document.createElement("mark");
      mark.textContent = source.slice(s, e);
      target.append(mark);
      cursor = e;
    }
    target.append(source.slice(cursor));
  };

  const snippetFor = (entry, terms) => {
    const body = entry.body;
    if (body) {
      const lower = body.toLowerCase();
      for (const term of terms) {
        const at = lower.indexOf(term);
        if (at !== -1) {
          const start = Math.max(0, at - SNIPPET_RADIUS);
          const end = Math.min(body.length, at + term.length + SNIPPET_RADIUS * 2);
          return `${start > 0 ? "…" : ""}${body.slice(start, end).trim()}${end < body.length ? "…" : ""}`;
        }
      }
    }
    return entry.summary;
  };

  const render = ({ hits, total, terms }, query) => {
    const items = hits.map(({ entry }) => {
      const li = document.createElement("li");
      li.className = "search-result";
      const a = document.createElement("a");
      a.className = "search-result-title";
      a.href = entry.url;
      highlight(a, entry.title, terms);
      const meta = document.createElement("p");
      meta.className = "search-result-meta";
      if (entry.date) {
        const time = document.createElement("time");
        time.dateTime = entry.date;
        time.textContent = entry.date;
        meta.append(time);
      }
      for (const tag of entry.tags) {
        const span = document.createElement("span");
        span.className = "search-result-tag";
        span.textContent = `#${tag}`;
        meta.append(span);
      }
      const snippet = document.createElement("p");
      snippet.className = "search-result-snippet";
      highlight(snippet, snippetFor(entry, terms), terms);
      li.append(a, meta, snippet);
      return li;
    });
    list.replaceChildren(...items);
    let message = total
      ? text.textCount.replace("{count}", String(total))
      : text.textEmpty.replace("{query}", query.trim());
    if (contentState === "loading" || contentState === "idle") message += ` ${text.textPartial}`;
    setStatus(message);
  };

  // ---- Wiring ----
  async function run(query) {
    const gen = ++generation;
    const url = new URL(location.href);
    if (query.trim()) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    history.replaceState(null, "", url);

    if (!query.trim()) {
      list.replaceChildren();
      setStatus(text.textHint);
      return;
    }
    loadContent();
    if (!entries) {
      setStatus(text.textLoading);
      try { await metaReady; } catch { setStatus(text.textError); return; }
      if (gen !== generation) return;
    }
    const result = await search(query, gen);
    if (result && gen === generation) render(result, query);
  }

  input.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => run(input.value), DEBOUNCE_MS);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    window.clearTimeout(timer);
    run(input.value);
  });
  metaReady.catch(() => setStatus(text.textError));

  const initial = new URLSearchParams(location.search).get("q");
  // The field has `autofocus`; only a ?q= query needs script.
  if (initial) {
    input.value = initial;
    run(initial);
  }
}
