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
  const jsonFiles = [
    "../misc/words_additional.json",
    "../misc/words_additional_custom.json",
    "../misc/unknown_chunks_cedict_enriched.json",
    "../misc/words_additional_custom_from_unknown_nouns.json",
  ];

  console.log("Reading word files:", jsonFiles.join(", "));

  const words: WordEntry[] = [];

  for (const file of jsonFiles) {
    const filePath = join(__dirname, file);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      console.log(`  ${file}: ${data.length} words`);
      words.push(...data);
    }
  }

  if (words.length === 0) {
    console.error("\nError: No word files found!");
    throw new Error("Missing word files");
  }

  console.log(`Loaded ${words.length} words from JSON`);

  const entriesToInsert = words.map((word) => ({
    simplified_zh: word.simplified_zh,
    traditional_zh: word.traditional_zh,
    pinyin: convertNumericToPinyin(word.pinyin_numeric),
    pinyin_numeric: word.pinyin_numeric,
    english: JSON.stringify(word.english),
    hsk_approx: word.hsk_approx || "unknown",
    source: word.source,
  }));

  console.log(`Upserting ${entriesToInsert.length} words...`);

  // Upsert using raw SQL to preserve IDs
  for (const entry of entriesToInsert) {
    await knex.raw(
      `INSERT INTO words_additional (simplified_zh, traditional_zh, pinyin, pinyin_numeric, english, hsk_approx, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(simplified_zh) DO UPDATE SET
         traditional_zh = excluded.traditional_zh,
         pinyin = excluded.pinyin,
         pinyin_numeric = excluded.pinyin_numeric,
         english = excluded.english,
         hsk_approx = excluded.hsk_approx,
         source = excluded.source`,
      [
        entry.simplified_zh,
        entry.traditional_zh,
        entry.pinyin,
        entry.pinyin_numeric,
        entry.english,
        entry.hsk_approx,
        entry.source,
      ]
    );
  }

  console.log(`\nSeeded ${entriesToInsert.length} words into words_additional`);
}
