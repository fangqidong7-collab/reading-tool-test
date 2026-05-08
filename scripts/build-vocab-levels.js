/**
 * Builds public/vocab-levels.json from Oxford 5000–style JSON
 * (word + cefr per entry). Duplicate words keep the easiest CEFR level.
 */

const fs = require("fs");
const path = require("path");

const INPUT_PATH =
  "/Users/dongf/.cursor/projects/Users-dongf-Documents-Cursor-Projects-reading-tool-test/agent-tools/2477d4c2-fbf5-479c-ace8-95ed6ebbffb5.txt";
const OUTPUT_PATH = path.join(
  __dirname,
  "..",
  "public",
  "vocab-levels.json",
);

const LEVEL_RANK = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

function normalizeCefr(raw) {
  if (raw == null || typeof raw !== "string") return null;
  const s = raw.trim().toUpperCase();
  if (LEVEL_RANK[s] != null) return s;
  return null;
}

function loadOxfordJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    let lastEnd = 0;
    const re = /"us":"[^"]*"\s*\n\s*\},/g;
    let m;
    while ((m = re.exec(raw)) !== null) lastEnd = m.index + m[0].length;
    let body = raw.slice(0, lastEnd).trimEnd().replace(/,\s*$/, "");
    return JSON.parse(`${body}\n}`);
  }
}

function buildMapping(data) {
  /** @type {Map<string, number>} */
  const bestRank = new Map();
  /** @type {Map<string, string>} */
  const bestLevel = new Map();

  for (const key of Object.keys(data)) {
    const entry = data[key];
    if (!entry || typeof entry !== "object") continue;
    const word = entry.word;
    const level = normalizeCefr(entry.cefr);
    if (word == null || typeof word !== "string" || !level) continue;

    const rank = LEVEL_RANK[level];
    const prev = bestRank.get(word);
    if (prev == null || rank < prev) {
      bestRank.set(word, rank);
      bestLevel.set(word, level);
    }
  }

  const keys = [...bestLevel.keys()].sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" }),
  );
  /** @type {Record<string, string>} */
  const out = {};
  for (const k of keys) out[k] = bestLevel.get(k);
  return out;
}

function main() {
  const data = loadOxfordJson(INPUT_PATH);
  const mapping = buildMapping(data);
  const unique = Object.keys(mapping).length;

  const perLevel = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
  for (const lvl of Object.values(mapping)) {
    perLevel[lvl] = (perLevel[lvl] || 0) + 1;
  }

  const json = JSON.stringify(mapping);
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, json, "utf8");

  const bytes = Buffer.byteLength(json, "utf8");

  console.log(JSON.stringify({ unique, perLevel, bytes }, null, 2));
}

main();
