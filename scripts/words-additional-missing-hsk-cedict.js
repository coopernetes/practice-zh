#!/usr/bin/env node
/**
 * Parse missing HSK words from CSV and enrich with CC-CEDICT data.
 *
 * Reads:
 *   - misc/hacking-chinese_missing-hsk-words.csv
 *   - misc/cedict_1_0_ts_utf-8_mdbg.txt
 *
 * Outputs:
 *   - misc/words_hsk_missing.json (enriched words ready for seeding)
 *   - misc/words_hsk_missing.notfound.json (words not found in CC-CEDICT)
 *
 * Usage:
 *   node scripts/words-additional-missing-hsk-cedict.js
 */

import fs from "node:fs";
import readline from "node:readline";

// Hardcoded paths
const CEDICT_PATH = "./misc/cedict_1_0_ts_utf-8_mdbg.txt";
const MISSING_CSV_PATH = "./misc/hacking-chinese_missing-hsk-words.csv";
const OUTPUT_PATH = "./misc/words_additional.json";
const NOT_FOUND_PATH = "./misc/words_additional.notfound.json";

/**
 * Parse a line from CC-CEDICT
 * Format: TRAD SIMP [PINYIN] /def1/def2/.../
 */
function parseCedictLine(line) {
  if (line.startsWith("#") || line.trim() === "") return null;

  const match = line.match(/^(.+?)\s+(.+?)\s+\[(.+?)\]\s+\/(.+)\/\s*$/);
  if (!match) return null;

  const [, traditional, simplified, pinyin, defsRaw] = match;
  const definitions = defsRaw.split("/").filter((d) => d.trim());

  return { traditional, simplified, pinyin, definitions };
}

/**
 * Load CC-CEDICT into a map keyed by simplified Chinese
 */
async function loadCedict(cedictPath) {
  const map = new Map();

  const fileStream = fs.createReadStream(cedictPath, { encoding: "utf8" });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const entry = parseCedictLine(line);
    if (entry) {
      // Store by simplified, keep first occurrence
      if (!map.has(entry.simplified)) {
        map.set(entry.simplified, entry);
      }
    }
  }

  return map;
}

/**
 * Parse CSV and return words with their HSK approximation
 * CSV format: HSK1-3,HSK4,HSK5,HSK6 (header)
 *             word1,word2,word3,word4
 */
function parseWordsCsv(csvPath) {
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.trim().split("\n");

  const wordMap = new Map();

  // Skip header, parse data
  const dataLines = lines.slice(1);
  const headers = ["1-3", "4", "5", "6"];

  for (const line of dataLines) {
    const columns = line.split(",");
    columns.forEach((word, idx) => {
      if (word.trim()) {
        wordMap.set(word.trim(), headers[idx]);
      }
    });
  }

  return wordMap;
}

async function main() {
  console.log("Loading CC-CEDICT...");
  const cedictMap = await loadCedict(CEDICT_PATH);
  console.log(`Loaded ${cedictMap.size} entries from CC-CEDICT`);

  console.log("\nParsing missing words CSV...");
  const missingWords = parseWordsCsv(MISSING_CSV_PATH);
  console.log(`Found ${missingWords.size} missing words`);

  const entries = [];
  const notFoundInCedict = [];

  // Process missing words
  console.log("\nProcessing missing words...");
  for (const [word, hskApprox] of missingWords) {
    const cedict = cedictMap.get(word);
    if (!cedict) {
      notFoundInCedict.push({ word, hskApprox });
      continue;
    }

    entries.push({
      simplified_zh: cedict.simplified,
      traditional_zh: cedict.traditional,
      pinyin_numeric: cedict.pinyin,
      english: cedict.definitions,
      hsk_approx: hskApprox,
      source:
        "https://www.hackingchinese.com/what-important-words-are-missing-from-hsk/",
    });
  }

  console.log(`\n${entries.length} words enriched with CC-CEDICT data`);
  console.log(`${notFoundInCedict.length} words not found in CC-CEDICT`);

  // Write output files
  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(entries, null, 2) + "\n",
    "utf8"
  );
  console.log(`\nWrote ${OUTPUT_PATH}`);

  if (notFoundInCedict.length) {
    fs.writeFileSync(
      NOT_FOUND_PATH,
      JSON.stringify(notFoundInCedict, null, 2) + "\n",
      "utf8"
    );
    console.log(`Wrote ${NOT_FOUND_PATH}`);
  }

  console.log("\nDone! Run 'npm run seed' to populate the database.");
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
