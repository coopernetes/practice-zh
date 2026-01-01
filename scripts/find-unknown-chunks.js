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

async function getWord(simplified_zh) {
  // Check words_hsk first
  const hskWord = await db("words_hsk").where({ simplified_zh }).first();
  if (hskWord) return hskWord;

  // Then check words_hsk_missing
  const missingWord = await db("words_hsk_missing")
    .where({ simplified_zh })
    .first();
  if (missingWord) return missingWord;

  return null;
}

// Check if a character/chunk appears in any HSK word (even as a component)
async function appearsInHSKWords(chunk) {
  const hskMatch = await db("words_hsk")
    .where("simplified_zh", "like", `%${chunk}%`)
    .first();
  if (hskMatch) return true;

  const missingMatch = await db("words_hsk_missing")
    .where("simplified_zh", "like", `%${chunk}%`)
    .first();
  return !!missingMatch;
}

// Find unknown chunks using nodejieba segmentation with fallback
async function findUnknownChunks(zh) {
  const chunks = [];
  const segments = nodejieba.cut(zh);

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

    // Check if this segment is in our known words
    const word = await getWord(segment);
    if (!word) {
      // Unknown segment - try to break it down into known components
      // using longest-match from left to right
      let remaining = segment;
      let currentUnknown = "";

      while (remaining.length > 0) {
        let found = false;

        // Try longest matches first (up to 4 chars)
        for (let len = Math.min(4, remaining.length); len >= 1; len--) {
          const candidate = remaining.slice(0, len);
          const knownWord = await getWord(candidate);

          if (knownWord) {
            // Found a known word - save any accumulated unknown chars first
            if (currentUnknown) {
              chunks.push(currentUnknown);
              currentUnknown = "";
            }
            remaining = remaining.slice(len);
            found = true;
            break;
          }
        }

        if (!found) {
          // This character might be unknown - check if it appears in any HSK word
          const char = remaining[0];
          const appearsInHSK = await appearsInHSKWords(char);

          if (!appearsInHSK) {
            // Truly unknown - doesn't appear anywhere in HSK vocabulary
            currentUnknown += char;
          } else {
            // Save accumulated unknown chars first
            if (currentUnknown) {
              chunks.push(currentUnknown);
              currentUnknown = "";
            }
            // This char is known (appears in compound words), skip it
          }

          remaining = remaining.slice(1);
        }
      }

      // Don't forget trailing unknown
      if (currentUnknown) {
        chunks.push(currentUnknown);
      }
    }
  }

  return chunks;
}

async function main() {
  const sentences = await db("sentences_tatoeba").select("zh_id", "zh", "en");
  const allChunks = new Map(); // chunk -> Set of sentence ids

  for (const { zh_id, zh } of sentences) {
    if (hasASCII(zh)) continue;

    const chunks = await findUnknownChunks(zh);
    for (const chunk of chunks) {
      if (!allChunks.has(chunk)) {
        allChunks.set(chunk, new Set());
      }
      allChunks.get(chunk).add(zh_id);
    }
  }

  // Sort by frequency (most common first)
  const sorted = [...allChunks.entries()]
    .map(([chunk, ids]) => ({ chunk, count: ids.size, ids: [...ids] }))
    .sort((a, b) => b.count - a.count);

  // Write TSV
  const lines = ["chunk\tcount\texample_ids"];
  for (const { chunk, count, ids } of sorted) {
    lines.push(`${chunk}\t${count}\t${ids.slice(0, 5).join(",")}`);
  }

  fs.writeFileSync("misc/unknown_chunks.tsv", lines.join("\n"));
  console.log(
    `Found ${sorted.length} unknown chunks. Written to misc/unknown_chunks.tsv`
  );

  await db.destroy();
}

main();
