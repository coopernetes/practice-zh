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
  /** Part of speech descriptor */
  p: string[];
  /** frequency  */
  q: number;
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

const fixupUmlaut = (pinyin: string) => {
  return pinyin.replace(/u:3/g, "ǚ");
};

const partOfSpeech = (code: string) => {
  const posMap: Record<string, string> = {
    a: "adjective",
    ad: "adjective as adverbial",
    ag: "adjective morpheme",
    an: "adjective with nominal function",
    b: "non-predicate adjective",
    c: "conjunction",
    d: "adverb",
    dg: "adverb morpheme",
    e: "interjection",
    f: "directional locality",
    g: "morpheme",
    h: "prefix",
    i: "idiom",
    j: "abbreviation",
    k: "suffix",
    l: "fixed expressions",
    m: "numeral",
    mg: "numeric morpheme",
    n: "common noun",
    ng: "noun morpheme",
    nr: "personal name",
    ns: "place name",
    nt: "organization name",
    nx: "nominal character string",
    nz: "other proper noun",
    o: "onomatopoeia",
    p: "preposition",
    q: "classifier",
    r: "pronoun",
    rg: "pronoun morpheme",
    s: "space word",
    t: "time word",
    tg: "time word morpheme",
    u: "auxiliary",
    v: "verb",
    vd: "verb as adverbial",
    vg: "verb morpheme",
    vn: "verb with nominal function",
    w: "symbol and non-sentential punctuation",
    x: "unclassified items",
    y: "modal particle",
    z: "descriptive",
  };
  return posMap[code] || code;
};

export async function seed(knex: Knex): Promise<void> {
  await knex("words_hsk").del();

  const rawData: MinWordEntry[] = JSON.parse(readFileSync(wordlist, "utf-8"));
  await knex.batchInsert(
    "words_hsk",
    rawData.map((word) => ({
      simplified_zh: word.s,
      traditional_zh: JSON.stringify(word.f.map((f) => f.t)),
      pinyin: JSON.stringify(word.f.map((f) => fixupUmlaut(f.i.y))),
      pinyin_numeric: JSON.stringify(word.f.map((f) => f.i.n)),
      meanings: JSON.stringify(word.f.map((f) => f.m)),
      part_of_speech: JSON.stringify(word.p.map((pos) => partOfSpeech(pos))),
      frequency: word.q,
      hsk2_level: extractHskLevel(word.l, "o"),
      hsk3_level: extractHskLevel(word.l, "n"),
    })),
    100
  );
}
