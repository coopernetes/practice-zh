import type { Knex } from "knex";
import { readFileSync } from "node:fs";

const wordlist = "vendor/complete-hsk-vocabulary/complete.min.json";

interface Transcription {
  /** Pinyin */
  y: string;
  /** Pinyin numeric superscript */
  n: string;
}

interface EntryForm {
  /** traditional Chinese character(s) */
  t: string;
  /** transcription forms */
  i: Transcription;
  /** Description & meanings in English */
  m: string[];
}

interface MinWordEntry {
  /** simplified Chinese character(s) */
  s: string;
  /** HSK level formatted as "{version}{difficulty_level}" (n=HSK 3.0, o=HSK 2.0) */
  l: string[];
  /** List of transcriptions of the word */
  f: EntryForm[];
}

const extractHskLevel = (levels: string[], prefix: string) => {
  for (const level of levels) {
    if (level.startsWith(prefix)) {
      if (level.length < 2 || level.length > 3) {
        console.warn(`Found unexpected level string: ${level}`);
      }
      return level.length === 2
        ? level.charAt(1)
        : level.slice(1, level.length);
    }
  }
};

export async function up(knex: Knex): Promise<void> {
  const rawData: MinWordEntry[] = JSON.parse(readFileSync(wordlist, "utf-8"));
  await knex.batchInsert(
    'words',
    rawData.map((word) => ({
      simplified_chars: word.s,
      traditional_chars: JSON.stringify(word.f.map((f) => f.t)),
      pinyin: JSON.stringify(word.f.map((f) => f.i.y)),
      pinyin_numeric: JSON.stringify(word.f.map((f) => f.i.n)),
      meanings: JSON.stringify(word.f.map((f) => f.m)),
      hsk2_level: extractHskLevel(word.l, "o"),
      hsk3_level: extractHskLevel(word.l, "n")
    })),
    100
  );
}


export async function down(knex: Knex): Promise<void> {
  return knex('words').del();
}

