import knex from "knex";
import nodejieba from "nodejieba";
import {
  isCJK,
  isChinesePunctuation,
  hasASCII,
  splitTokenIntoKnownAndUnknown,
} from "./lib/chinese.js";
import { loadHskWords, loadWordsFromJsonFiles } from "./lib/hsk.js";

const dbConfig = {
  client: "better-sqlite3",
  connection: {
    filename: "./practice-zh.sqlite3",
  },
  useNullAsDefault: true,
};

const db = knex(dbConfig);

// Find unknown CJK characters in a sentence using the same logic as the pipeline
function findUnknownInSentence(zh, known) {
  const unknowns = new Set();
  const segments = nodejieba.cut(zh);

  for (const segment of segments) {
    if (isChinesePunctuation(segment)) continue;

    const containsCJK = [...segment].some(isCJK);
    if (!containsCJK) continue;

    if (known.has(segment)) continue;

    // Use DP algorithm to split token optimally
    const pieces = splitTokenIntoKnownAndUnknown(segment, known, 6);
    const hasUnknown = pieces.some((p) => !p.known);
    if (!hasUnknown) continue;

    for (const piece of pieces) {
      if (piece.known) continue;
      if ([...piece.text].every(isChinesePunctuation)) continue;
      unknowns.add(piece.text);
    }
  }

  return [...unknowns];
}

async function main() {
  // Load all known words using the same logic as the pipeline
  console.error("Loading vocabulary...");
  const hskWords = loadHskWords();
  const additionalWords = loadWordsFromJsonFiles([
    "./misc/words_additional.json",
    "./misc/words_additional_custom.json",
    "./misc/unknown_chunks_cedict_enriched.json",
    "./misc/words_additional_custom_from_unknown_nouns.json",
  ]);

  const known = new Set([...hskWords, ...additionalWords]);
  console.error(`Loaded ${known.size.toLocaleString()} known words`);

  const sentences = await db("sentences_tatoeba").select("id", "zh", "en");
  console.error(`Processing ${sentences.length.toLocaleString()} sentences...`);

  // Output header
  console.log("id\tzh\ten\tunknown_chars");

  let count = 0;
  for (const { id, zh, en } of sentences) {
    // Skip sentences with ASCII
    if (hasASCII(zh)) continue;

    const unknowns = findUnknownInSentence(zh, known);
    if (unknowns.length > 0) {
      console.log(`${id}\t${zh}\t${en}\t${unknowns.join("")}`);
      count++;
    }
  }

  console.error(`\nFound ${count} sentences with unknown words`);
  await db.destroy();
}

main();
