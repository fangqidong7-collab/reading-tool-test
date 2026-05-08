/**
 * Builds public/vocab-levels.json by merging (priority order):
 *  1. Oxford 3000 CSV  (A1-B2, ~3800 entries)
 *  2. Oxford 5000 CSV  (A1-C1, ~5370 entries)
 *  3. Oxford 5000 expansion PDF  (B2+C1 words)
 *  4. Academic Word List (AWL) 570 families (~3000 word forms, as B2/C1)
 *  5. Maximax67/Words-CEFR-Dataset  (frequency-filtered supplement)
 *
 * For duplicate words, keeps the LOWEST (easiest) CEFR level.
 */

const fs = require("fs");
const path = require("path");

const AGENT_TOOLS = "/Users/dongf/.cursor/projects/Users-dongf-Documents-Cursor-Projects-reading-tool-test/agent-tools";

const CSV_3000 = path.join(AGENT_TOOLS, "8627db02-4446-4125-b292-a03a0e4fb3c2.txt");
const CSV_5000 = path.join(AGENT_TOOLS, "85b7ddda-764d-4891-9e0d-432d518965b8.txt");
const PDF_5000 = path.join(AGENT_TOOLS, "52f45d0c-5492-4a21-b580-c4c2eb15af26.txt");
const CEFR_WORDS = path.join(AGENT_TOOLS, "823b565c-7dfa-4d50-aa24-f00ebd826592.txt");
const CEFR_POS = path.join(AGENT_TOOLS, "07a44115-6f6d-4c40-93f6-9a815a38cf0f.txt");
const AWL_FAMILIES = path.join(AGENT_TOOLS, "eb02c4e3-db0a-4967-b4db-9166cd4ff961.txt");
const AWL_SIMPLE = path.join(AGENT_TOOLS, "d1c2f659-2550-425f-81ee-7f77caa4cca2.txt");
const GRE_WORDS = path.join(AGENT_TOOLS, "gre-words-5349.txt");
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

function parseCEFRDataset(wordsFile, posFile) {
  const wordMap = new Map();
  const wLines = fs.readFileSync(wordsFile, "utf8").split("\n");
  for (let i = 1; i < wLines.length; i++) {
    const m = wLines[i].match(/^"(\d+)","([^"]+)"/);
    if (m) wordMap.set(m[1], m[2]);
  }

  const wordData = new Map();
  const pLines = fs.readFileSync(posFile, "utf8").split("\n");
  for (let i = 1; i < pLines.length; i++) {
    const parts = pLines[i].replace(/"/g, "").split(",");
    if (parts.length < 6) continue;
    const wid = parts[1];
    const freq = parseInt(parts[4]) || 0;
    const lvl = parseFloat(parts[5]);
    if (isNaN(lvl) || lvl < 1 || lvl > 6) continue;
    const prev = wordData.get(wid);
    if (!prev || lvl < prev.lvl) {
      wordData.set(wid, { lvl, freq: Math.max(freq, prev?.freq || 0) });
    } else if (prev) {
      prev.freq = Math.max(prev.freq, freq);
    }
  }

  const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const results = [];
  for (const [wid, data] of wordData) {
    const word = wordMap.get(wid);
    if (!word || word.length < 2 || !/^[a-z]/i.test(word)) continue;
    const idx = Math.min(Math.round(data.lvl) - 1, 5);
    results.push({ word: word.toLowerCase(), cefr: LEVELS[idx], freq: data.freq });
  }
  return results;
}

function parseAWLFamilies(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const words = new Set();
  let sublist = 0;
  for (const line of text.split("\n")) {
    const t = line.trim().toLowerCase();
    const sm = t.match(/^sublist\s+(\d+)/);
    if (sm) { sublist = parseInt(sm[1]); continue; }
    if (/^[a-z]{3,}$/.test(t)) words.add(t);
  }
  return [...words];
}

function parseAWLSimple(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const words = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^([a-z][a-z\-]+)\b/);
    if (m && m[1].length >= 3) words.push(m[1]);
  }
  return words;
}

function parseGREWords(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const words = [];
  for (const line of text.split("\n")) {
    const parts = line.split("\t");
    if (parts.length < 1) continue;
    const w = parts[0].trim().toLowerCase();
    if (/^[a-z]{3,}$/.test(w)) words.push(w);
  }
  return words;
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

  const oxfordCount = mapping.size;
  console.log(`Oxford total: ${oxfordCount} unique words`);

  console.log("Parsing AWL word families...");
  const awlFamilies = parseAWLFamilies(AWL_FAMILIES);
  const awlSimple = parseAWLSimple(AWL_SIMPLE);
  const awlAll = new Set([...awlFamilies, ...awlSimple]);
  let awlAdded = 0;
  for (const w of awlAll) {
    if (!mapping.has(w)) {
      mapping.set(w, "B2");
      awlAdded++;
    }
  }
  console.log(`  -> ${awlAll.size} AWL forms, ${awlAdded} new words added`);

  console.log("Parsing GRE Master Wordlist (C1 level)...");
  const greWords = parseGREWords(GRE_WORDS);
  let greAdded = 0;
  for (const w of greWords) {
    if (!mapping.has(w)) {
      mapping.set(w, "C1");
      greAdded++;
    }
  }
  console.log(`  -> ${greWords.length} GRE words, ${greAdded} new words added`);

  const MIN_FREQ = 500;
  console.log(`Parsing CEFR extended dataset (freq >= ${MIN_FREQ})...`);
  const cefrj = parseCEFRDataset(CEFR_WORDS, CEFR_POS);
  console.log(`  -> ${cefrj.length} entries total`);
  let cefrjAdded = 0;
  for (const e of cefrj) {
    const w = e.word.toLowerCase().replace(/[^a-z\-]/g, "").trim();
    if (!w || w.length < 3) continue;
    if (/^(.)\1+$/.test(w)) continue;
    if (e.freq < MIN_FREQ) continue;
    if (!mapping.has(w)) {
      mapping.set(w, e.cefr);
      cefrjAdded++;
      if (w.includes("-")) {
        const nh = w.replace(/-/g, "");
        if (nh.length >= 3 && !mapping.has(nh)) {
          mapping.set(nh, e.cefr);
          cefrjAdded++;
        }
      }
    }
  }
  console.log(`  -> ${cefrjAdded} new words added from CEFR dataset`);

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
