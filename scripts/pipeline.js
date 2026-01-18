#!/usr/bin/env node
/**
 * Unified Data Pipeline Script
 *
 * Orchestrates the vocabulary enrichment pipeline:
 *   1. enrich-missing-hsk  - Enrich missing HSK words with CEDICT
 *   2. enrich-custom       - Enrich custom word lists with CEDICT
 *   3. generate-corpus     - Generate corpus-specific vocabulary from sentences
 *
 * Usage:
 *   node scripts/pipeline.js        # Run full pipeline
 *   node scripts/pipeline.js stats  # Show coverage statistics
 *   node scripts/pipeline.js --help # Show help
 */

import fs from "node:fs";
import nodejieba from "nodejieba";
import { loadCedict, numericToToneMarks } from "./lib/cedict.js";
import {
  createDb,
  loadKnownWords,
  getWordCounts,
  getSentenceCount,
} from "./lib/db.js";
import { isCJK, isChinesePunctuation, hasASCII } from "./lib/chinese.js";
import {
  loadHskWords,
  loadWordsFromJsonFiles,
  loadSentencesFromTsv,
} from "./lib/hsk.js";

// =============================================================================
// File Paths
// =============================================================================

const PATHS = {
  // Inputs
  missingHskCsv: "./data/raw/hacking-chinese_missing-hsk-words.csv",
  customWords: "./data/custom/custom_words.json",
  pronouns: "./data/custom/pronouns.json",

  // Outputs (interim)
  wordsAdditional: "./data/interim/words_additional.json",
  wordsAdditionalNotFound: "./data/interim/words_additional.notfound.json",
  wordsCorpusCedict: "./data/interim/words_corpus_cedict.json",
  wordsCorpusNotFound: "./data/interim/words_corpus_notfound.json",
};

// =============================================================================
// Step 1: Enrich Missing HSK Words
// =============================================================================

function parseWordsCsv(csvPath) {
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.trim().split("\n");
  const wordMap = new Map();
  const headers = ["1-3", "4", "5", "6"];

  for (const line of lines.slice(1)) {
    const columns = line.split(",");
    columns.forEach((word, idx) => {
      if (word.trim()) {
        wordMap.set(word.trim(), headers[idx]);
      }
    });
  }

  return wordMap;
}

async function enrichMissingHsk(cedictMap, hskWords) {
  console.log("\nStep 1: Enriching missing HSK words with CEDICT...");

  if (!fs.existsSync(PATHS.missingHskCsv)) {
    console.log(`   Skipping: ${PATHS.missingHskCsv} not found`);
    return { found: 0, notFound: 0 };
  }

  const missingWords = parseWordsCsv(PATHS.missingHskCsv);
  console.log(`   Found ${missingWords.size} missing HSK words`);

  const entries = [];
  const notFoundInCedict = [];
  let skippedExisting = 0;

  for (const [word, hskLevel] of missingWords) {
    // Skip if already in words_hsk
    if (hskWords.has(word)) {
      skippedExisting++;
      continue;
    }

    const cedict = cedictMap.get(word);
    if (cedict) {
      entries.push({
        simplified_zh: cedict.simplified,
        traditional_zh: cedict.traditional,
        pinyin_numeric: cedict.pinyin,
        english: cedict.definitions,
        hsk_approx: hskLevel,
        source: "hacking-chinese-missing",
      });
    } else {
      notFoundInCedict.push({ word, hsk_approx: hskLevel });
    }
  }

  fs.writeFileSync(
    PATHS.wordsAdditional,
    JSON.stringify(entries, null, 2) + "\n",
  );
  console.log(`   ${entries.length} words → ${PATHS.wordsAdditional}`);
  if (skippedExisting > 0) {
    console.log(`   ${skippedExisting} words already in HSK (skipped)`);
  }

  if (notFoundInCedict.length) {
    fs.writeFileSync(
      PATHS.wordsAdditionalNotFound,
      JSON.stringify(notFoundInCedict, null, 2) + "\n",
    );
    console.log(
      `   ${notFoundInCedict.length} not found → ${PATHS.wordsAdditionalNotFound}`,
    );
  }

  return { found: entries.length, notFound: notFoundInCedict.length };
}

// =============================================================================
// Step 2: Generate Corpus-Specific Vocabulary
// =============================================================================

async function generateCorpusWords(cedictMap, knownWords, minFrequency = 5) {
  console.log(
    `\nStep 2: Generating corpus vocabulary (≥${minFrequency} occurrences)...`,
  );

  // Load sentences from TSV files
  const sentences = loadSentencesFromTsv([
    "./data/processed/sentences_tatoeba.simplified.tsv",
    "./data/custom/sentences_custom.tsv",
  ]);

  const wordFrequency = new Map();
  let processed = 0;

  for (const sentence of sentences) {
    if (hasASCII(sentence.zh)) continue;

    const segments = nodejieba.cut(sentence.zh);

    for (const seg of segments) {
      if (isChinesePunctuation(seg)) continue;
      const hasCJK = [...seg].some((c) => isCJK(c));
      if (!hasCJK) continue;

      if (!knownWords.has(seg)) {
        wordFrequency.set(seg, (wordFrequency.get(seg) || 0) + 1);
      }
    }

    processed++;
    if (processed % 5000 === 0) {
      process.stdout.write(`\r   Processing: ${processed}/${sentences.length}`);
    }
  }
  console.log(`\r   Processed ${processed} sentences`);

  // Filter by frequency
  const sortedByFreq = [...wordFrequency.entries()]
    .filter(([word, freq]) => freq >= minFrequency)
    .sort((a, b) => b[1] - a[1]);

  console.log(
    `   Found ${sortedByFreq.length} words with ≥${minFrequency} occurrences`,
  );

  // Enrich with CEDICT
  const enriched = [];
  const notFound = [];

  for (const [word, frequency] of sortedByFreq) {
    const cedict = cedictMap.get(word);

    if (cedict) {
      enriched.push({
        simplified_zh: cedict.simplified,
        traditional_zh: cedict.traditional,
        pinyin_numeric: cedict.pinyin,
        english: cedict.definitions,
        frequency_in_corpus: frequency,
        source: "corpus-cedict",
      });
    } else {
      notFound.push({ word, frequency });
    }
  }

  console.log(`   ${enriched.length} words enriched with CEDICT`);
  console.log(`   ${notFound.length} not found in CEDICT`);

  // Write outputs
  fs.writeFileSync(
    PATHS.wordsCorpusCedict,
    JSON.stringify(enriched, null, 2) + "\n",
  );
  console.log(`   Wrote → ${PATHS.wordsCorpusCedict}`);

  if (notFound.length > 0) {
    fs.writeFileSync(
      PATHS.wordsCorpusNotFound,
      JSON.stringify(notFound, null, 2) + "\n",
    );
    console.log(`   Words not in CEDICT → ${PATHS.wordsCorpusNotFound}`);
    console.log(`   (Consider adding these to ${PATHS.customWords})`);
  }

  return { found: enriched.length, notFound: notFound.length };
}

// =============================================================================
// Step 3: Enrich Custom Words
// =============================================================================

async function enrichCustomWords(cedictMap, inputPath) {
  console.log(`\nStep 3: Enriching custom words from ${inputPath}...`);

  if (!fs.existsSync(inputPath)) {
    console.log(`   Skipping: ${inputPath} not found`);
    return { found: 0, notFound: 0 };
  }

  const customWords = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
  console.log(`   Found ${customWords.length} words to enrich`);

  const entries = [];
  const notFoundInCedict = [];

  for (const wordObj of customWords) {
    // Already has complete data (pinyin_numeric + either definitions or en)
    if (wordObj.pinyin_numeric && (wordObj.definitions || wordObj.en)) {
      const english =
        wordObj.definitions ||
        (Array.isArray(wordObj.en) ? wordObj.en : [wordObj.en]);
      entries.push({
        simplified_zh: wordObj.simplified_zh,
        traditional_zh: wordObj.traditional_zh,
        pinyin_numeric: wordObj.pinyin_numeric,
        english: english,
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

  const outputPath = inputPath
    .replace("data/custom/", "data/interim/")
    .replace(".json", "_enriched.json");
  fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2) + "\n");
  console.log(`   ${entries.length} enriched → ${outputPath}`);

  if (notFoundInCedict.length) {
    const notFoundPath = inputPath
      .replace("data/custom/", "data/interim/")
      .replace(".json", "_notfound.json");
    fs.writeFileSync(
      notFoundPath,
      JSON.stringify(notFoundInCedict, null, 2) + "\n",
    );
    console.log(`   ${notFoundInCedict.length} not found → ${notFoundPath}`);
  }

  return { found: entries.length, notFound: notFoundInCedict.length };
}

// =============================================================================
// Stats Command
// =============================================================================

async function showStats() {
  console.log("\nCoverage Statistics\n");

  const db = createDb();

  try {
    const wordCounts = await getWordCounts(db);
    const sentenceCount = await getSentenceCount(db);
    const known = await loadKnownWords(db);

    console.log(`Words:`);
    console.log(`  HSK vocabulary:        ${wordCounts.hsk.toLocaleString()}`);
    console.log(
      `  Additional vocabulary: ${wordCounts.additional.toLocaleString()}`,
    );
    console.log(`  Total known words:     ${known.size.toLocaleString()}`);
    console.log(`\nSentences: ${sentenceCount.toLocaleString()}`);
  } finally {
    await db.destroy();
  }
}

// =============================================================================
// Main
// =============================================================================

function printHelp() {
  console.log(`
Usage: node scripts/pipeline.js [command]

Commands:
  (default)  Run the full pipeline
  stats      Show coverage statistics
  --help, -h Show this help message

Full Pipeline Steps:
  1. Enrich missing HSK words with CEDICT data
  2. Generate corpus-specific vocabulary from sentences
  3. Enrich custom word lists with CEDICT data

After running, use 'npm run seed:words' to load new words into the database.
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "full";

  if (command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "stats") {
    await showStats();
    return;
  }

  console.log("Chinese Vocabulary Data Pipeline\n");
  console.log("Loading CC-CEDICT...");
  const cedictMap = await loadCedict();
  console.log(
    `Loaded ${cedictMap.size.toLocaleString()} entries from CC-CEDICT\n`,
  );

  // Load HSK vocabulary
  console.log("Loading HSK vocabulary...");
  const hskWords = loadHskWords();
  console.log(`Loaded ${hskWords.size.toLocaleString()} HSK words`);

  // Step 1: Enrich missing HSK words
  await enrichMissingHsk(cedictMap, hskWords);

  // Step 2: Enrich custom words and pronouns
  await enrichCustomWords(cedictMap, PATHS.customWords);
  await enrichCustomWords(cedictMap, PATHS.pronouns);

  // Step 3: Generate corpus-specific vocabulary
  // Load known words from files generated in steps 1-2
  const knownWords = new Set([
    ...hskWords,
    ...loadWordsFromJsonFiles([
      PATHS.wordsAdditional,
      "./data/interim/custom_words_enriched.json",
      "./data/interim/pronouns_enriched.json",
    ]),
  ]);
  console.log(`\nKnown vocabulary: ${knownWords.size.toLocaleString()} words`);

  await generateCorpusWords(cedictMap, knownWords, 5);

  console.log("\n" + "=".repeat(60));
  console.log("Pipeline complete!\n");
  console.log("Generated JSON files:");
  console.log(`  - ${PATHS.wordsAdditional}`);
  console.log(
    `  - ${PATHS.customWords.replace("data/custom/", "data/interim/").replace(".json", "_enriched.json")}`,
  );
  console.log(
    `  - ${PATHS.pronouns.replace("data/custom/", "data/interim/").replace(".json", "_enriched.json")}`,
  );
  console.log(`  - ${PATHS.wordsCorpusCedict}`);
  console.log(`  - ${PATHS.wordsCorpusNotFound}`);
  console.log("\nNext steps:");
  console.log("  1. Review data/interim/words_corpus_notfound.json");
  console.log(
    "  2. Manually add missing words to data/custom/custom_words.json or data/custom/pronouns.json",
  );
  console.log("  3. Run 'npm run seed:words' to load vocabulary into database");
  console.log("  4. Run 'npm run dev' to test");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
