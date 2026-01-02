#!/usr/bin/env node
/**
 * Generate custom_words.json entries from unknown chunks using CEDICT.
 *
 * Reads:
 *   - misc/unknown_chunks.tsv (from find-unknown-chunks.js)
 *   - misc/cedict_1_0_ts_utf-8_mdbg.txt
 *
 * Outputs:
 *   - misc/unknown_chunks_cedict.json (words found in CEDICT)
 *   - misc/unknown_chunks_notfound.json (words not in CEDICT)
 *
 * Usage:
 *   node scripts/unknown-chunks-to-custom-words.js
 */

import fs from "node:fs";
import readline from "node:readline";

const CEDICT_PATH = "./misc/cedict_1_0_ts_utf-8_mdbg.txt";
const CHUNKS_PATH = "./misc/unknown_chunks.tsv";
const OUTPUT_PATH = "./misc/unknown_chunks_cedict.json";
const NOT_FOUND_PATH = "./misc/unknown_chunks_notfound.json";

/**
 * Convert numbered pinyin (e.g., "bu4 hui4") to tone marks
 */
function numericToToneMarks(pinyin) {
  const toneMap = {
    a: ["ā", "á", "ǎ", "à", "a"],
    e: ["ē", "é", "ě", "è", "e"],
    i: ["ī", "í", "ǐ", "ì", "i"],
    o: ["ō", "ó", "ǒ", "ò", "o"],
    u: ["ū", "ú", "ǔ", "ù", "u"],
    ü: ["ǖ", "ǘ", "ǚ", "ǜ", "ü"],
    v: ["ǖ", "ǘ", "ǚ", "ǜ", "ü"], // v is often used for ü
  };

  return pinyin
    .split(" ")
    .map((syllable) => {
      const toneMatch = syllable.match(/(\d)$/);
      if (!toneMatch) return syllable;

      const tone = parseInt(toneMatch[1], 10);
      let base = syllable.slice(0, -1).toLowerCase();

      // Replace u: or v with ü
      base = base.replace(/u:/g, "ü").replace(/v/g, "ü");

      // Find the vowel to add tone mark to (following standard rules)
      const vowelOrder = ["a", "e", "ou", "o", "iu", "ui", "i", "u", "ü"];

      for (const v of vowelOrder) {
        if (base.includes(v)) {
          const targetVowel = v.length > 1 ? v[v.length - 1] : v;
          if (toneMap[targetVowel] && tone >= 1 && tone <= 5) {
            base = base.replace(targetVowel, toneMap[targetVowel][tone - 1]);
          }
          break;
        }
      }

      return base;
    })
    .join(" ");
}

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
 * Load unknown chunks from TSV
 */
function loadUnknownChunks(tsvPath) {
  const content = fs.readFileSync(tsvPath, "utf-8");
  const lines = content.trim().split("\n");

  // Skip header
  return lines.slice(1).map((line) => {
    const [chunk, count] = line.split("\t");
    return { chunk, count: parseInt(count, 10) };
  });
}

async function main() {
  console.log("Loading CC-CEDICT...");
  const cedictMap = await loadCedict(CEDICT_PATH);
  console.log(`Loaded ${cedictMap.size} entries from CC-CEDICT`);

  console.log("\nLoading unknown chunks...");
  const chunks = loadUnknownChunks(CHUNKS_PATH);
  console.log(`Found ${chunks.length} unknown chunks`);

  const found = [];
  const notFound = [];

  for (const { chunk, count } of chunks) {
    const cedictEntry = cedictMap.get(chunk);

    if (cedictEntry) {
      found.push({
        simplified_zh: cedictEntry.simplified,
        traditional_zh: cedictEntry.traditional,
        pinyin: numericToToneMarks(cedictEntry.pinyin),
        pinyin_numeric: cedictEntry.pinyin,
        definitions: cedictEntry.definitions,
        frequency_in_corpus: count,
      });
    } else {
      notFound.push({ chunk, count });
    }
  }

  // Sort found by frequency
  found.sort((a, b) => b.frequency_in_corpus - a.frequency_in_corpus);

  // Write outputs
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(found, null, 2));
  fs.writeFileSync(NOT_FOUND_PATH, JSON.stringify(notFound, null, 2));

  console.log(`\nResults:`);
  console.log(`  Found in CEDICT: ${found.length} → ${OUTPUT_PATH}`);
  console.log(`  Not found: ${notFound.length} → ${NOT_FOUND_PATH}`);

  // Preview top 10
  console.log(`\nTop 10 found:`);
  for (const entry of found.slice(0, 10)) {
    console.log(
      `  ${entry.simplified_zh} (${entry.pinyin}) - ${entry.definitions[0]}`
    );
  }
}

main();
