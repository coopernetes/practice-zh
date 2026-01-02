#!/usr/bin/env node
/**
 * Unified Data Pipeline Script
 *
 * Orchestrates the vocabulary enrichment pipeline:
 *   1. enrich-missing-hsk  - Enrich missing HSK words with CEDICT
 *   2. find-unknown        - Scan sentences for unknown chunks
 *   3. lookup-unknown      - Look up unknown chunks in CEDICT
 *   4. enrich-custom       - Enrich custom word lists with CEDICT
 *
 * Usage:
 *   node scripts/pipeline.js              # Run full pipeline
 *   node scripts/pipeline.js stats        # Show coverage statistics
 *   node scripts/pipeline.js find-unknown # Just find unknown chunks
 *   node scripts/pipeline.js enrich       # Run enrichment steps (3-4)
 *   node scripts/pipeline.js --help       # Show help
 */

import fs from "node:fs";
import { execSync } from "node:child_process";
import nodejieba from "nodejieba";
import { loadCedict, numericToToneMarks } from "./lib/cedict.js";
import {
  createDb,
  loadKnownWords,
  getWordCounts,
  getSentenceCount,
} from "./lib/db.js";
import {
  isCJK,
  isChinesePunctuation,
  hasASCII,
  splitTokenIntoKnownAndUnknown,
} from "./lib/chinese.js";
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
  missingHskCsv: "./misc/hacking-chinese_missing-hsk-words.csv",
  unknownChunksTsv: "./misc/unknown_chunks.tsv",

  // Outputs
  wordsAdditional: "./misc/words_additional.json",
  wordsAdditionalNotFound: "./misc/words_additional.notfound.json",
  unknownChunksCedict: "./misc/unknown_chunks_cedict.json",
  unknownChunksNotFound: "./misc/unknown_chunks_notfound.json",
  unknownChunksCedictEnriched: "./misc/unknown_chunks_cedict_enriched.json",
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
    JSON.stringify(entries, null, 2) + "\n"
  );
  console.log(`   ${entries.length} words → ${PATHS.wordsAdditional}`);
  if (skippedExisting > 0) {
    console.log(`   ${skippedExisting} words already in HSK (skipped)`);
  }

  if (notFoundInCedict.length) {
    fs.writeFileSync(
      PATHS.wordsAdditionalNotFound,
      JSON.stringify(notFoundInCedict, null, 2) + "\n"
    );
    console.log(
      `   ${notFoundInCedict.length} not found → ${PATHS.wordsAdditionalNotFound}`
    );
  }

  return { found: entries.length, notFound: notFoundInCedict.length };
}

// =============================================================================
// Step 2: Find Unknown Chunks
// =============================================================================

function findUnknownChunksInSentence(sentence, known) {
  const unknownChunks = [];
  const segments = nodejieba.cut(sentence);

  for (const segment of segments) {
    if (isChinesePunctuation(segment)) continue;

    const containsCJK = [...segment].some(isCJK);
    if (!containsCJK) continue;

    if (known.has(segment)) continue;

    const pieces = splitTokenIntoKnownAndUnknown(segment, known, 6);
    const hasUnknown = pieces.some((p) => !p.known);
    if (!hasUnknown) continue;

    for (const piece of pieces) {
      if (piece.known) continue;
      if ([...piece.text].every(isChinesePunctuation)) continue;
      unknownChunks.push(piece.text);
    }
  }

  return unknownChunks;
}

async function findUnknownChunks(known, db = null) {
  console.log("\nStep 2: Finding unknown chunks in sentences...");

  // Load sentences from database if available, otherwise from TSV
  let sentences;
  if (db) {
    const rows = await db("sentences_tatoeba").select("zh_id", "zh");
    sentences = rows.map((row) => ({ id: row.zh_id, zh: row.zh }));
  } else {
    sentences = loadSentencesFromTsv([
      "./misc/Sentence pairs in Mandarin Chinese-English - 2025-12-30.tsv",
      "./misc/sentences_custom.tsv",
    ]);
  }

  const chunkFrequency = new Map();

  let processed = 0;
  for (const { zh } of sentences) {
    if (hasASCII(zh)) continue;

    const chunks = findUnknownChunksInSentence(zh, known);

    for (const chunk of chunks) {
      if (!chunkFrequency.has(chunk)) {
        chunkFrequency.set(chunk, new Set());
      }
      chunkFrequency.get(chunk).add(processed);
    }

    processed++;
    if (processed % 10000 === 0) {
      process.stdout.write(`\r   Processing: ${processed}/${sentences.length}`);
    }
  }
  console.log(`\r   Processed ${processed} sentences`);

  const sortedChunks = [...chunkFrequency.entries()]
    .map(([chunk, sentenceIds]) => ({
      chunk,
      count: sentenceIds.size,
      exampleIds: [...sentenceIds].slice(0, 5),
    }))
    .sort((a, b) => b.count - a.count);

  const outputLines = ["chunk\tcount\texample_ids"];
  for (const { chunk, count, exampleIds } of sortedChunks) {
    outputLines.push(`${chunk}\t${count}\t${exampleIds.join(",")}`);
  }

  fs.writeFileSync(PATHS.unknownChunksTsv, outputLines.join("\n"));
  console.log(
    `   ${sortedChunks.length} unknown chunks → ${PATHS.unknownChunksTsv}`
  );

  return sortedChunks.length;
}

// =============================================================================
// Step 3: Look Up Unknown Chunks in CEDICT
// =============================================================================

function loadUnknownChunksTsv() {
  if (!fs.existsSync(PATHS.unknownChunksTsv)) return [];

  const content = fs.readFileSync(PATHS.unknownChunksTsv, "utf-8");
  const lines = content.trim().split("\n");

  return lines.slice(1).map((line) => {
    const [chunk, count] = line.split("\t");
    return { chunk, count: parseInt(count, 10) };
  });
}

async function lookupUnknownChunks(cedictMap, hskWords) {
  console.log("\nStep 3: Looking up unknown chunks in CEDICT...");

  const chunks = loadUnknownChunksTsv();
  if (!chunks.length) {
    console.log(`   No unknown chunks to process`);
    return { found: 0, notFound: 0 };
  }

  console.log(`   Found ${chunks.length} unknown chunks to look up`);

  const found = [];
  const notFound = [];
  let skippedExisting = 0;

  for (const { chunk, count } of chunks) {
    // Skip if already in words_hsk
    if (hskWords.has(chunk)) {
      skippedExisting++;
      continue;
    }

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

  found.sort((a, b) => b.frequency_in_corpus - a.frequency_in_corpus);

  fs.writeFileSync(PATHS.unknownChunksCedict, JSON.stringify(found, null, 2));
  console.log(
    `   ${found.length} found in CEDICT → ${PATHS.unknownChunksCedict}`
  );
  if (skippedExisting > 0) {
    console.log(`   ${skippedExisting} chunks already in HSK (skipped)`);
  }

  fs.writeFileSync(
    PATHS.unknownChunksNotFound,
    JSON.stringify(notFound, null, 2)
  );
  console.log(
    `   ${notFound.length} not in CEDICT → ${PATHS.unknownChunksNotFound}`
  );

  return { found: found.length, notFound: notFound.length };
}

// =============================================================================
// Step 4: Enrich Custom Words
// =============================================================================

async function enrichCustomWords(cedictMap, inputPath) {
  console.log(`\nStep 4: Enriching custom words from ${inputPath}...`);

  if (!fs.existsSync(inputPath)) {
    console.log(`   Skipping: ${inputPath} not found`);
    return { found: 0, notFound: 0 };
  }

  const customWords = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
  console.log(`   Found ${customWords.length} words to enrich`);

  const entries = [];
  const notFoundInCedict = [];

  for (const wordObj of customWords) {
    // Already has CEDICT data
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

  const outputPath = inputPath.replace(".json", "_enriched.json");
  fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2) + "\n");
  console.log(`   ${entries.length} enriched → ${outputPath}`);

  if (notFoundInCedict.length) {
    const notFoundPath = inputPath.replace(".json", "_notfound.json");
    fs.writeFileSync(
      notFoundPath,
      JSON.stringify(notFoundInCedict, null, 2) + "\n"
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
      `  Additional vocabulary: ${wordCounts.additional.toLocaleString()}`
    );
    console.log(`  Total known words:     ${known.size.toLocaleString()}`);
    console.log(`\nSentences: ${sentenceCount.toLocaleString()}`);

    // Count unknown chunks if TSV exists
    if (fs.existsSync(PATHS.unknownChunksTsv)) {
      const chunks = loadUnknownChunksTsv();
      console.log(`\nUnknown chunks: ${chunks.length.toLocaleString()}`);

      if (chunks.length > 0) {
        console.log(`\nTop 10 most frequent unknown chunks:`);
        for (const { chunk, count } of chunks.slice(0, 10)) {
          console.log(`  ${chunk.padEnd(8)} - appears in ${count} sentences`);
        }
      }
    }
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
  (default)       Run the full pipeline
  stats           Show coverage statistics
  find-unknown    Find unknown chunks in sentences (step 2)
  enrich          Run enrichment steps (steps 3-4)
  --help, -h      Show this help message

Full Pipeline Steps:
  1. Enrich missing HSK words with CEDICT data
  2. Find unknown chunks in sentences
  3. Look up unknown chunks in CEDICT
  4. Enrich custom word lists

After running, use 'npm run seed' to load new words into the database.
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
    `Loaded ${cedictMap.size.toLocaleString()} entries from CC-CEDICT`
  );

  const db = createDb();

  try {
    const verbose = process.argv.includes("--verbose");

    if (command === "stats") {
      await showStats(db);
    } else if (command === "find-unknown") {
      const hskWords = loadHskWords();
      const known = new Set([
        ...hskWords,
        ...loadWordsFromJsonFiles([
          PATHS.wordsAdditional,
          "./misc/words_additional_custom.json",
          "./misc/unknown_chunks_cedict_enriched.json",
          "./misc/words_additional_custom_from_unknown_nouns.json",
        ]),
      ]);
      if (verbose) {
        console.log(`Loaded ${known.size.toLocaleString()} known words`);
      }
      await findUnknownChunks(known, db);
    } else if (command === "enrich") {
      const hskWords = loadHskWords();
      await lookupUnknownChunks(cedictMap, hskWords);
      await enrichCustomWords(cedictMap, PATHS.unknownChunksCedict);
      if (!verbose) {
        console.log(
          "\nEnrichment complete. Run 'npm run seed:words' to update database."
        );
      }
    } else if (command === "--full" || command === "full") {
      console.log("Running full pipeline with iterations...\n");

      // Load HSK words once (source of truth from vendor)
      console.log("Loading HSK vocabulary...");
      const hskWords = loadHskWords();
      console.log(`   Loaded ${hskWords.size.toLocaleString()} HSK words`);

      // Step 1: Enrich missing HSK words
      await enrichMissingHsk(cedictMap, hskWords);

      // Clear accumulated enriched words file from previous runs
      const enrichedPath = PATHS.unknownChunksCedict.replace(
        ".json",
        "_enriched.json"
      );
      fs.writeFileSync(enrichedPath, JSON.stringify([], null, 2) + "\n");

      // Track all enriched words across iterations
      const allEnrichedWords = [];

      // Load all known words into memory (HSK + additional JSONs)
      let knownWords = new Set([
        ...hskWords,
        ...loadWordsFromJsonFiles([
          PATHS.wordsAdditional,
          "./misc/words_additional_custom.json",
          "./misc/words_additional_custom_from_unknown_nouns.json",
        ]),
      ]);

      // Iterate: find unknowns → enrich → accumulate → repeat
      let iteration = 1;
      let previousUnknowns = Infinity;
      const maxIterations = 5;

      while (iteration <= maxIterations) {
        console.log(`\n--- Iteration ${iteration} ---`);

        // Step 2: Find unknowns using in-memory word set
        const unknownCount = await findUnknownChunks(knownWords, db);

        // Check if we've converged
        if (unknownCount >= previousUnknowns) {
          console.log(`\nConverged at ${unknownCount} unknowns. Stopping.`);
          break;
        }

        if (unknownCount === 0) {
          console.log("\nNo unknowns remaining!");
          break;
        }

        previousUnknowns = unknownCount;

        // Step 3: Lookup and enrich unknowns
        await lookupUnknownChunks(cedictMap, hskWords);
        await enrichCustomWords(cedictMap, PATHS.unknownChunksCedict);

        // Load the newly enriched words
        if (fs.existsSync(enrichedPath)) {
          const newlyEnriched = JSON.parse(
            fs.readFileSync(enrichedPath, "utf-8")
          );
          allEnrichedWords.push(...newlyEnriched);
          // Write accumulated enriched words
          fs.writeFileSync(
            enrichedPath,
            JSON.stringify(allEnrichedWords, null, 2) + "\n"
          );
          console.log(
            `   Total accumulated: ${allEnrichedWords.length} enriched words`
          );

          // Add newly enriched words to our in-memory known set
          for (const word of newlyEnriched) {
            if (word.simplified_zh) {
              knownWords.add(word.simplified_zh);
            }
          }
        }

        iteration++;
      }

      // Step 4: Seed database once at the end
      console.log("\nSeeding database with all enriched vocabulary...");
      execSync("npm run seed:words", {
        stdio: verbose ? "inherit" : "ignore",
      });

      if (verbose) {
        await showStats(db);
      } else {
        console.log(
          "\nPipeline complete. Run 'npm run pipeline:stats' for details."
        );
      }
    } else {
      // Default: Full pipeline (legacy behavior)
      const hskWords = loadHskWords();
      await enrichMissingHsk(cedictMap, hskWords);

      const known = new Set([
        ...hskWords,
        ...loadWordsFromJsonFiles([
          PATHS.wordsAdditional,
          "./misc/words_additional_custom.json",
          "./misc/words_additional_custom_from_unknown_nouns.json",
        ]),
      ]);
      if (verbose) {
        console.log(
          `\nLoaded ${known.size.toLocaleString()} known words from files`
        );
      }

      await findUnknownChunks(known, db);
      await lookupUnknownChunks(cedictMap, hskWords);
      await enrichCustomWords(cedictMap, PATHS.unknownChunksCedict);

      if (verbose) {
        console.log("\n" + "=".repeat(60));
        console.log("Pipeline complete!");
        console.log("\nNext steps:");
        console.log("  1. Review the generated JSON files in misc/");
        console.log("  2. Run 'npm run seed' to load words into the database");
        console.log(
          "  3. Run 'node scripts/pipeline.js stats' to see coverage"
        );
      } else {
        console.log(
          "\nEnrichment complete. Run 'npm run seed:words && npm run pipeline:find-unknown' to update database."
        );
      }
    }
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
