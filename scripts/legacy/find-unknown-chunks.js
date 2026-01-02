#!/usr/bin/env node
/**
 * find-unknown-chunks.js
 *
 * Scans all sentences in sentences_tatoeba and identifies Chinese segments
 * that are NOT in our vocabulary (words_hsk + words_additional).
 *
 * Uses nodejieba for initial segmentation, then applies dynamic programming
 * to split jieba segments into known/unknown pieces, maximizing coverage
 * by known words.
 *
 * Output: misc/unknown_chunks.tsv - unknown chunks sorted by frequency
 *
 * Usage:
 *   node scripts/find-unknown-chunks.js
 */

import knex from "knex";
import fs from "fs";
import nodejieba from "nodejieba";

// =============================================================================
// Database Configuration
// =============================================================================

const dbConfig = {
  client: "better-sqlite3",
  connection: { filename: "./practice-zh.sqlite3" },
  useNullAsDefault: true,
};

const db = knex(dbConfig);

// =============================================================================
// Character Classification Utilities
// =============================================================================

/**
 * Check if a character is in the CJK Unified Ideographs block.
 * Range: U+4E00 to U+9FFF (common Chinese characters)
 */
function isCJK(char) {
  const code = char.charCodeAt(0);
  return code >= 0x4e00 && code <= 0x9fff;
}

/** Common Chinese punctuation marks */
const CHINESE_PUNCTUATION = new Set([
  "。",
  "，",
  "、",
  "；",
  "：",
  "？",
  "！",
  "\u201C", // "
  "\u201D", // "
  "\u2018", // '
  "\u2019", // '
  "（",
  "）",
  "【",
  "】",
  "《",
  "》",
  "—",
  "…",
  "·",
  "～",
]);

function isChinesePunctuation(str) {
  return str.length === 1 && CHINESE_PUNCTUATION.has(str);
}

/** Check if string contains any ASCII letters or numbers */
function hasASCII(str) {
  return /[A-Za-z0-9]/.test(str);
}

// =============================================================================
// Dictionary Loading
// =============================================================================

/**
 * Load all known vocabulary into a Set for O(1) lookup.
 * Combines words from both HSK and additional vocabulary tables.
 *
 * @returns {Promise<Set<string>>} Set of known simplified Chinese words
 */
async function loadKnownSet() {
  const known = new Set();

  const hskWords = await db("words_hsk").select("simplified_zh");
  for (const row of hskWords) {
    known.add(row.simplified_zh);
  }

  const additionalWords = await db("words_additional").select("simplified_zh");
  for (const row of additionalWords) {
    known.add(row.simplified_zh);
  }

  return known;
}

// =============================================================================
// Dynamic Programming Word Splitter
// =============================================================================

/**
 * Split a token into known and unknown pieces using dynamic programming.
 *
 * This function finds the optimal way to decompose a string such that:
 * 1. Maximum characters are covered by known words (primary goal)
 * 2. Minimum number of pieces are used (secondary goal, reduces fragmentation)
 *
 * Example: "玛丽很高" with known = {很, 高}
 *   → [{text: "玛丽", known: false}, {text: "很", known: true}, {text: "高", known: true}]
 *
 * @param {string} token - The string to split
 * @param {Set<string>} known - Set of known vocabulary words
 * @param {number} maxWordLen - Maximum word length to try (default: 6)
 * @returns {Array<{text: string, known: boolean}>} Array of pieces
 */
function splitTokenIntoKnownAndUnknown(token, known, maxWordLen = 6) {
  const chars = [...token]; // Handle multi-byte characters correctly
  const n = chars.length;

  // DP state: for each position i, track the best way to cover chars[0..i)
  // - covered: how many chars are matched by known words (maximize this)
  // - pieces: how many pieces used (minimize this, as tiebreaker)
  // - prev: previous position (for backtracking)
  // - pieceText: the text of the piece ending at this position
  // - pieceKnown: whether this piece is a known word
  const dp = Array(n + 1).fill(null);
  dp[0] = { covered: 0, pieces: 0, prev: -1, pieceText: "", pieceKnown: false };

  /**
   * Compare two DP states. Returns true if 'a' is better than 'b'.
   * Prefer more covered chars, then fewer pieces.
   */
  const isBetter = (a, b) => {
    if (a.covered !== b.covered) return a.covered > b.covered;
    return a.pieces < b.pieces;
  };

  // Fill DP table
  for (let i = 0; i < n; i++) {
    if (!dp[i]) continue; // Unreachable state

    // Option 1: Take current char as unknown (single character)
    const unknownState = {
      covered: dp[i].covered, // No additional coverage
      pieces: dp[i].pieces + 1,
      prev: i,
      pieceText: chars[i],
      pieceKnown: false,
    };
    if (!dp[i + 1] || isBetter(unknownState, dp[i + 1])) {
      dp[i + 1] = unknownState;
    }

    // Option 2: Try matching known words of length 1 to maxWordLen
    for (let len = 1; len <= maxWordLen && i + len <= n; len++) {
      const candidate = chars.slice(i, i + len).join("");

      if (!known.has(candidate)) continue; // Not a known word

      const knownState = {
        covered: dp[i].covered + len, // Add coverage for this word
        pieces: dp[i].pieces + 1,
        prev: i,
        pieceText: candidate,
        pieceKnown: true,
      };

      if (!dp[i + len] || isBetter(knownState, dp[i + len])) {
        dp[i + len] = knownState;
      }
    }
  }

  // Backtrack to reconstruct the solution
  const piecesReversed = [];
  let position = n;
  while (position > 0) {
    const state = dp[position];
    if (!state) break;
    piecesReversed.push({ text: state.pieceText, known: state.pieceKnown });
    position = state.prev;
  }
  piecesReversed.reverse();

  // Merge adjacent pieces with the same known/unknown status
  // e.g., [unknown:"玛", unknown:"丽"] → [unknown:"玛丽"]
  const mergedPieces = [];
  for (const piece of piecesReversed) {
    const lastPiece = mergedPieces[mergedPieces.length - 1];
    if (lastPiece && lastPiece.known === piece.known) {
      lastPiece.text += piece.text;
    } else {
      mergedPieces.push({ ...piece });
    }
  }

  return mergedPieces;
}

// =============================================================================
// Unknown Chunk Detection
// =============================================================================

/**
 * Find all unknown chunks in a Chinese sentence.
 *
 * Process:
 * 1. Use nodejieba to segment the sentence into tokens
 * 2. For each token not in our dictionary, use DP to split into known/unknown
 * 3. Collect only the unknown pieces
 *
 * @param {string} sentence - Chinese sentence to analyze
 * @param {Set<string>} known - Set of known vocabulary words
 * @returns {string[]} Array of unknown chunks found in the sentence
 */
function findUnknownChunks(sentence, known) {
  const unknownChunks = [];
  const segments = nodejieba.cut(sentence);

  for (const segment of segments) {
    // Skip punctuation
    if (isChinesePunctuation(segment)) continue;

    // Skip segments without Chinese characters
    const containsCJK = [...segment].some(isCJK);
    if (!containsCJK) continue;

    // Skip if the whole segment is already known
    if (known.has(segment)) continue;

    // Split segment into known/unknown pieces
    const pieces = splitTokenIntoKnownAndUnknown(segment, known, 6);

    // If everything split into known words, nothing to report
    const hasUnknown = pieces.some((p) => !p.known);
    if (!hasUnknown) continue;

    // Collect unknown pieces (skip pure punctuation)
    for (const piece of pieces) {
      if (piece.known) continue;
      if ([...piece.text].every(isChinesePunctuation)) continue;
      unknownChunks.push(piece.text);
    }
  }

  return unknownChunks;
}

// =============================================================================
// Main Execution
// =============================================================================

async function main() {
  // Load vocabulary
  const known = await loadKnownSet();
  console.log(`Loaded ${known.size} known words`);

  // Process all sentences
  const sentences = await db("sentences_tatoeba").select("zh_id", "zh");
  const chunkFrequency = new Map(); // chunk → Set of sentence IDs

  for (const { zh_id, zh } of sentences) {
    // Skip sentences with ASCII (likely mixed language)
    if (hasASCII(zh)) continue;

    const chunks = findUnknownChunks(zh, known);

    for (const chunk of chunks) {
      if (!chunkFrequency.has(chunk)) {
        chunkFrequency.set(chunk, new Set());
      }
      chunkFrequency.get(chunk).add(zh_id);
    }
  }

  // Sort by frequency (most common first)
  const sortedChunks = [...chunkFrequency.entries()]
    .map(([chunk, sentenceIds]) => ({
      chunk,
      count: sentenceIds.size,
      exampleIds: [...sentenceIds].slice(0, 5), // Keep first 5 examples
    }))
    .sort((a, b) => b.count - a.count);

  // Write TSV output
  const outputLines = ["chunk\tcount\texample_ids"];
  for (const { chunk, count, exampleIds } of sortedChunks) {
    outputLines.push(`${chunk}\t${count}\t${exampleIds.join(",")}`);
  }

  const outputPath = "misc/unknown_chunks.tsv";
  fs.writeFileSync(outputPath, outputLines.join("\n"));
  console.log(`Found ${sortedChunks.length} unknown chunks → ${outputPath}`);

  await db.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
