import type { Knex } from "knex";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface WordEntry {
  simplified_zh: string;
  traditional_zh: string;
  pinyin_numeric: string;
  english: string[]; // Array of definitions
  hsk_approx: string;
  source: string;
}

const convertNumericToPinyin = (pinyinNumeric: string): string => {
  const toneMap: { [key: string]: string[] } = {
    a: ["ā", "á", "ǎ", "à"],
    e: ["ē", "é", "ě", "è"],
    i: ["ī", "í", "ǐ", "ì"],
    o: ["ō", "ó", "ǒ", "ò"],
    u: ["ū", "ú", "ǔ", "ù"],
    ü: ["ǖ", "ǘ", "ǚ", "ǜ"],
  };

  return pinyinNumeric.replace(/([a-zü]+)([1-5])/gi, (match, pinyin, tone) => {
    const toneNum = parseInt(tone, 10);
    if (toneNum === 5) return pinyin; // No tone mark for neutral tone

    // Find the vowel to place the tone mark on
    for (let i = 0; i < pinyin.length; i++) {
      const char = pinyin[i].toLowerCase();
      if (toneMap[char]) {
        const toneIndex = toneNum - 1;
        const markedVowel = toneMap[char][toneIndex];
        return pinyin.slice(0, i) + markedVowel + pinyin.slice(i + 1);
      }
    }
    return pinyin; // Fallback, should not reach here
  });
};

export async function seed(knex: Knex): Promise<void> {
  // Delete existing entries
  await knex("words_hsk_missing").del();

  const jsonPath = join(__dirname, "../misc/words_hsk_missing.json");

  console.log("Reading words_hsk_missing.json...");
  if (!fs.existsSync(jsonPath)) {
    console.error(`\nError: ${jsonPath} not found!`);
    console.error(
      "Run 'node scripts/missing-hsk-cedict.js' first to generate this file.\n"
    );
    throw new Error("Missing words_hsk_missing.json");
  }

  const words: WordEntry[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`Loaded ${words.length} words from JSON`);

  const entriesToInsert = words.map((word) => ({
    simplified_zh: word.simplified_zh,
    traditional_zh: word.traditional_zh,
    pinyin: convertNumericToPinyin(word.pinyin_numeric),
    pinyin_numeric: word.pinyin_numeric,
    english: JSON.stringify(word.english),
    hsk_approx: word.hsk_approx,
    source: word.source,
  }));

  console.log(`Inserting ${entriesToInsert.length} words...`);

  // Insert in batches
  const batchSize = 100;
  for (let i = 0; i < entriesToInsert.length; i += batchSize) {
    const batch = entriesToInsert.slice(i, i + batchSize);
    await knex("words_hsk_missing").insert(batch);
  }

  console.log(
    `\nSeeded ${entriesToInsert.length} words into words_hsk_missing`
  );
}
