import knex from "knex";
import fs from "fs";
import nodejieba from "nodejieba";

const dbConfig = {
  client: "better-sqlite3",
  connection: {
    filename: "./practice-zh.sqlite3",
  },
  useNullAsDefault: true,
};

const db = knex(dbConfig);

// CJK Unified Ideographs: U+4E00 to U+9FFF
function isCJK(char) {
  const code = char.charCodeAt(0);
  return code >= 0x4e00 && code <= 0x9fff;
}

// Chinese punctuation marks
const CHINESE_PUNCTUATION = new Set([
  "。",
  "，",
  "、",
  "；",
  "：",
  "？",
  "！",
  '"',
  '"',
  "'",
  "'",
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

function isChinesePunctuation(char) {
  return CHINESE_PUNCTUATION.has(char);
}

function hasASCII(str) {
  return /[A-Za-z0-9]/.test(str);
}

/**
 * Build a set of all words the user knows from all their banks
 */
async function getUserWordBank(userId) {
  // Get all bank IDs for this user
  const userBanks = await db("user_banks")
    .where({ user_id: userId })
    .select("id");

  const bankIds = userBanks.map((b) => b.id);

  if (bankIds.length === 0) {
    return new Set();
  }

  // Get all words from all user's banks
  const userWords = await db("user_bank_words")
    .whereIn("bank_id", bankIds)
    .select("word_hsk_id");

  const wordIds = userWords
    .map((row) => row.word_hsk_id)
    .filter((id) => id !== null);

  if (wordIds.length === 0) {
    return new Set();
  }

  // Get the actual simplified_zh values for these word_ids
  const hskWords = await db("words_hsk")
    .whereIn("id", wordIds)
    .select("simplified_zh");

  const allWords = new Set([...hskWords.map((w) => w.simplified_zh)]);

  return allWords;
}

/**
 * Check if a segment can be covered by the user's word bank
 * Returns: { known: boolean, breakdown: string[] }
 */
function canCoverSegment(segment, userWordBank) {
  // Direct match
  if (userWordBank.has(segment)) {
    return { known: true, breakdown: [segment] };
  }

  // Try to break down into known components (longest match first)
  let remaining = segment;
  const breakdown = [];

  while (remaining.length > 0) {
    let found = false;

    // Try longest matches first (up to 4 chars)
    for (let len = Math.min(4, remaining.length); len >= 1; len--) {
      const candidate = remaining.slice(0, len);
      if (userWordBank.has(candidate)) {
        breakdown.push(candidate);
        remaining = remaining.slice(len);
        found = true;
        break;
      }
    }

    if (!found) {
      // Cannot cover this part
      return { known: false, breakdown: null };
    }
  }

  return { known: true, breakdown };
}

/**
 * Calculate coverage score for a sentence given a user's word bank
 * Returns: { score: number (0-1), totalSegments: number, knownSegments: number, unknownSegments: string[] }
 */
function calculateCoverage(zh, userWordBank) {
  const segments = nodejieba.cut(zh);
  let totalSegments = 0;
  let knownSegments = 0;
  const unknownSegments = [];

  for (const segment of segments) {
    // Skip punctuation
    if (isChinesePunctuation(segment)) {
      continue;
    }

    // Skip non-CJK segments
    const hasCJK = [...segment].some((char) => isCJK(char));
    if (!hasCJK) {
      continue;
    }

    totalSegments++;

    const { known } = canCoverSegment(segment, userWordBank);
    if (known) {
      knownSegments++;
    } else {
      unknownSegments.push(segment);
    }
  }

  const score = totalSegments > 0 ? knownSegments / totalSegments : 0;
  return { score, totalSegments, knownSegments, unknownSegments };
}

/**
 * Find sentences suitable for quiz based on coverage threshold
 */
async function findQuizSentences(
  userId,
  minCoverage = 0.8,
  maxCoverage = 0.95,
  limit = 100
) {
  const userWordBank = await getUserWordBank(userId);
  console.log(`User knows ${userWordBank.size} words (from all banks)`);

  const sentences = await db("sentences_tatoeba").select("zh_id", "zh", "en");

  const candidates = [];

  for (const { zh_id, zh, en } of sentences) {
    // Skip sentences with ASCII
    if (hasASCII(zh)) continue;

    const coverage = calculateCoverage(zh, userWordBank);

    // Only include sentences within the coverage range
    if (coverage.score >= minCoverage && coverage.score <= maxCoverage) {
      candidates.push({
        zh_id,
        zh,
        en,
        coverage: coverage.score,
        totalSegments: coverage.totalSegments,
        knownSegments: coverage.knownSegments,
        unknownSegments: coverage.unknownSegments,
      });

      if (limit && candidates.length >= limit) {
        break;
      }
    }
  }

  return candidates;
}

async function main() {
  // Example: Find quiz sentences for user_id 1 (all their banks)
  const userId = 1;

  // Get limit from command line args: node script.js [limit]
  // If no limit provided, find all matching sentences
  const limit = process.argv[2] ? parseInt(process.argv[2], 10) : null;

  const quizSentences = await findQuizSentences(userId, 0.8, 0.95, limit);

  console.log(`\nFound ${quizSentences.length} quiz-ready sentences:\n`);

  // Display first 10
  for (const sentence of quizSentences.slice(0, 10)) {
    console.log(
      `[Tatoeba #${sentence.zh_id}] Coverage: ${(sentence.coverage * 100).toFixed(1)}%`
    );
    console.log(`  ZH: ${sentence.zh}`);
    console.log(`  EN: ${sentence.en}`);
    console.log(
      `  Known: ${sentence.knownSegments}/${sentence.totalSegments} segments`
    );
    if (sentence.unknownSegments.length > 0) {
      console.log(`  Unknown: ${sentence.unknownSegments.join(", ")}`);
    }
    console.log();
  }

  // Write to file
  const lines = [
    "zh_id\tcoverage\ttotal_segments\tknown_segments\tunknown_segments\tzh\ten",
  ];
  for (const s of quizSentences) {
    lines.push(
      `${s.zh_id}\t${s.coverage.toFixed(3)}\t${s.totalSegments}\t${s.knownSegments}\t${s.unknownSegments.join(",")}\t${s.zh}\t${s.en}`
    );
  }

  fs.writeFileSync("misc/quiz_sentences.tsv", lines.join("\n"));
  console.log(
    `\nWrote ${quizSentences.length} sentences to misc/quiz_sentences.tsv`
  );

  await db.destroy();
}

main();
