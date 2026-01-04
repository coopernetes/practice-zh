#!/usr/bin/env node
/**
 * Generate corpus vocabulary from Tatoeba sentences
 *
 * Segments sentences with nodejieba, finds words missing from HSK vocab,
 * and enriches with CEDICT data (including unicode pinyin).
 *
 * Usage:
 *   node scripts/generate-corpus-words.js [min-frequency]
 */

import fs from "node:fs";
import nodejieba from "nodejieba";
import { loadCedict, numericToToneMarks } from "./lib/cedict.js";
import { createDb } from "./lib/db.js";

const MIN_FREQUENCY = parseInt(process.argv[2]) || 5;
const OUTPUT_FILE = "./data/interim/words_corpus_cedict.json";
const NOT_FOUND_FILE = "./data/interim/words_corpus_notfound.json";

async function main() {
  console.log("Corpus Vocabulary Generator\n");

  const cedictMap = await loadCedict();
  console.log(`Loaded ${cedictMap.size.toLocaleString()} CEDICT entries\n`);

  const db = createDb();

  try {
    // Load HSK vocabulary only
    const hsk = await db("words_hsk").select("simplified_zh");
    const known = new Set(hsk.map((w) => w.simplified_zh));
    console.log(`${known.size.toLocaleString()} HSK words\n`);

    // Segment sentences
    const sentences = await db("sentences_tatoeba").select("zh");
    const wordFrequency = new Map();

    for (const { zh } of sentences) {
      for (const seg of nodejieba.cut(zh)) {
        if (!known.has(seg) && cedictMap.has(seg)) {
          wordFrequency.set(seg, (wordFrequency.get(seg) || 0) + 1);
        }
      }
    }
    console.log(`Processed ${sentences.length.toLocaleString()} sentences\n`);

    // Filter and sort by frequency
    const sorted = [...wordFrequency.entries()]
      .filter(([, freq]) => freq >= MIN_FREQUENCY)
      .sort((a, b) => b[1] - a[1]);

    // Enrich with CEDICT
    const enriched = sorted.map(([word, frequency]) => {
      const cedict = cedictMap.get(word);
      return {
        simplified_zh: cedict.simplified,
        traditional_zh: cedict.traditional,
        pinyin_numeric: cedict.pinyin,
        pinyin: numericToToneMarks(cedict.pinyin),
        english: cedict.definitions,
        frequency_in_corpus: frequency,
        source: "corpus-cedict",
      };
    });

    // Find words not in CEDICT (for logging)
    const allSegments = new Set();
    for (const { zh } of sentences) {
      for (const seg of nodejieba.cut(zh)) {
        if (!known.has(seg)) allSegments.add(seg);
      }
    }
    const notFound = [...allSegments]
      .filter((w) => !cedictMap.has(w))
      .map((word) => ({ word }));

    console.log(`${enriched.length} words enriched (≥${MIN_FREQUENCY} freq)`);
    console.log(`${notFound.length} segments not in CEDICT\n`);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(enriched, null, 2) + "\n");
    console.log(`Wrote → ${OUTPUT_FILE}`);

    if (notFound.length > 0) {
      fs.writeFileSync(
        NOT_FOUND_FILE,
        JSON.stringify(notFound, null, 2) + "\n",
      );
      console.log(`Wrote → ${NOT_FOUND_FILE}`);
    }

    // Top 10 preview
    console.log("\nTop 10:");
    for (const w of enriched.slice(0, 10)) {
      console.log(
        `  ${w.simplified_zh} (${w.frequency_in_corpus}x) ${w.pinyin}`,
      );
    }
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
