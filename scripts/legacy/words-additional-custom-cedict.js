#!/usr/bin/env node
/**
 * Parse missing HSK words from CSV and enrich with CC-CEDICT data.
 *
 * Reads:
 *   - misc/custom_words.json (or CUSTOM_WORDS_JSON env var)
 *   - misc/cedict_1_0_ts_utf-8_mdbg.txt
 *
 * Outputs:
 *   - misc/words_additional_custom.json (enriched words ready for seeding)
 *   - misc/words_additional_custom.notfound.json (words not found in CC-CEDICT)
 *
 * Usage:
 *   node scripts/words-additional-custom-cedict.js
 *   CUSTOM_WORDS_JSON=misc/unknown_chunks_cedict.json node scripts/words-additional-custom-cedict.js
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

// Paths - CUSTOM_WORDS_JSON can be overridden via env var
const CEDICT_PATH = "./misc/cedict_1_0_ts_utf-8_mdbg.txt";
const CUSTOM_WORDS_JSON =
  process.env.CUSTOM_WORDS_JSON || "./misc/custom_words.json";

// Derive output paths from input file name
const inputBasename = path.basename(CUSTOM_WORDS_JSON, ".json");
const OUTPUT_PATH = `./misc/${inputBasename}_enriched.json`;
const NOT_FOUND_PATH = `./misc/${inputBasename}_notfound.json`;

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

async function main() {
  console.log(`Input: ${CUSTOM_WORDS_JSON}`);
  console.log(`Output: ${OUTPUT_PATH}`);

  console.log("\nLoading CC-CEDICT...");
  const cedictMap = await loadCedict(CEDICT_PATH);
  console.log(`Loaded ${cedictMap.size} entries from CC-CEDICT`);

  console.log("\nParsing words JSON...");
  const customWords = JSON.parse(fs.readFileSync(CUSTOM_WORDS_JSON, "utf-8"));
  console.log(`Found ${customWords.length} words`);

  const entries = [];
  const notFoundInCedict = [];

  // Process words
  console.log("\nProcessing words...");
  for (const wordObj of customWords) {
    // Already has CEDICT data (from unknown-chunks-to-custom-words.js)
    if (wordObj.definitions && wordObj.pinyin_numeric) {
      entries.push({
        simplified_zh: wordObj.simplified_zh,
        traditional_zh: wordObj.traditional_zh,
        pinyin_numeric: wordObj.pinyin_numeric,
        english: wordObj.definitions,
        hsk_approx: wordObj.hsk_approx || null,
        source: "custom",
      });
      continue;
    }

    // Need to look up in CEDICT
    const cedict = cedictMap.get(wordObj.simplified_zh);
    if (!cedict) {
      notFoundInCedict.push(wordObj);
      continue;
    }

    entries.push({
      simplified_zh: cedict.simplified,
      traditional_zh: cedict.traditional,
      pinyin_numeric: cedict.pinyin,
      english: cedict.definitions,
      hsk_approx: wordObj.hsk_approx || null,
      source: "custom",
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
