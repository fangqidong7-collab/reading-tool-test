/**
 * Builds public/vocab-levels.json by merging:
 *  1. Oxford 3000 CSV (complete A1-B2, ~3800 entries)
 *  2. Oxford 5000 CSV (A1-C1, ~5370 entries, overlaps with 3000)
 *  3. Oxford 5000 expansion PDF text (B2+C1 words listed by level)
 *
 * For duplicate words, keeps the LOWEST (easiest) CEFR level.
 */

const fs = require("fs");
const path = require("path");

const AGENT_TOOLS = "/Users/dongf/.cursor/projects/Users-dongf-Documents-Cursor-Projects-reading-tool-test/agent-tools";

const CSV_3000 = path.join(AGENT_TOOLS, "8627db02-4446-4125-b292-a03a0e4fb3c2.txt");
const CSV_5000 = path.join(AGENT_TOOLS, "85b7ddda-764d-4891-9e0d-432d518965b8.txt");
const PDF_5000 = path.join(AGENT_TOOLS, "52f45d0c-5492-4a21-b580-c4c2eb15af26.txt");
const OUTPUT = path.join(__dirname, "..", "public", "vocab-levels.json");

const LEVEL_RANK = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

function normCefr(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim().toUpperCase();
  return LEVEL_RANK[s] != null ? s : null;
}

function parseCSV(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(",");
    if (parts.length < 4) continue;
    const word = (parts[1] || "").trim().toLowerCase();
    const cefr = normCefr(parts[3]);
    if (word && cefr) results.push({ word, cefr });
  }
  return results;
}

function parsePDFText(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const results = [];
  let currentLevel = null;
  const posRe = /(?:n|v|adj|adv|prep|conj|det|pron|number|excl|indefinite article)\./i;

  function extractWord(cell) {
    const m = cell.match(/^(.+?)\s+(?:n|v|adj|adv|prep|conj|det|pron|number|excl|indefinite article)[.,\s]/i);
    if (m) return m[1].trim().toLowerCase().replace(/[^a-z\-]/g, "");
    return null;
  }

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (/^[ABC][12]\s*$/.test(trimmed)) {
      currentLevel = trimmed.trim().toUpperCase();
      continue;
    }
    if (!currentLevel) continue;

    if (trimmed.includes("|")) {
      const cells = trimmed.split("|").map(c => c.trim()).filter(Boolean);
      for (const cell of cells) {
        if (cell === "---") continue;
        if (/^[ABC][12]$/.test(cell)) {
          currentLevel = cell.toUpperCase();
          continue;
        }
        const word = extractWord(cell);
        if (word && word.length > 1) {
          results.push({ word, cefr: currentLevel });
          if (word.includes("-")) {
            results.push({ word: word.replace(/-/g, ""), cefr: currentLevel });
          }
        }
      }
    } else {
      const match = trimmed.match(/^(.+?)\s+(?:n|v|adj|adv|prep|conj|det|pron|number|excl|indefinite article)\.\s*$/i);
      if (match) {
        const word = match[1].trim().toLowerCase().replace(/[^a-z\-]/g, "");
        if (word.length > 1) {
          results.push({ word, cefr: currentLevel });
          if (word.includes("-")) {
            results.push({ word: word.replace(/-/g, ""), cefr: currentLevel });
          }
        }
      }
    }
  }
  return results;
}

function main() {
  const mapping = new Map();

  function addWord(word, cefr) {
    const w = word.toLowerCase().replace(/[^a-z\-]/g, "").trim();
    if (!w || w.length < 2) return;
    const rank = LEVEL_RANK[cefr];
    if (!rank) return;
    const prev = mapping.get(w);
    if (!prev || rank < LEVEL_RANK[prev]) {
      mapping.set(w, cefr);
    }
    if (w.includes("-")) {
      const nohyphen = w.replace(/-/g, "");
      if (nohyphen.length >= 2) {
        const p2 = mapping.get(nohyphen);
        if (!p2 || rank < LEVEL_RANK[p2]) mapping.set(nohyphen, cefr);
      }
    }
  }

  console.log("Parsing Oxford 3000 CSV...");
  const csv3k = parseCSV(CSV_3000);
  console.log(`  -> ${csv3k.length} entries`);
  for (const e of csv3k) addWord(e.word, e.cefr);

  console.log("Parsing Oxford 5000 CSV...");
  const csv5k = parseCSV(CSV_5000);
  console.log(`  -> ${csv5k.length} entries`);
  for (const e of csv5k) addWord(e.word, e.cefr);

  console.log("Parsing Oxford 5000 expansion PDF text...");
  const pdf5k = parsePDFText(PDF_5000);
  console.log(`  -> ${pdf5k.length} entries`);
  for (const e of pdf5k) addWord(e.word, e.cefr);

  const keys = [...mapping.keys()].sort((a, b) => a.localeCompare(b, "en"));
  const out = {};
  for (const k of keys) out[k] = mapping.get(k);

  const perLevel = {};
  for (const v of Object.values(out)) perLevel[v] = (perLevel[v] || 0) + 1;

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(out), "utf8");

  const bytes = Buffer.byteLength(JSON.stringify(out), "utf8");
  console.log(`\nResult: ${Object.keys(out).length} unique words, ${bytes} bytes`);
  console.log("Per level:", perLevel);
}

main();
