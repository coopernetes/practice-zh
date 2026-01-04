/**
 * CC-CEDICT parsing utilities
 *
 * Shared functions for loading and working with the CC-CEDICT dictionary.
 */

import fs from "node:fs";
import readline from "node:readline";

export const CEDICT_PATH = "./data/raw/cedict_1_0_ts_utf-8_mdbg.txt";

/**
 * Parse a line from CC-CEDICT
 * Format: TRAD SIMP [PINYIN] /def1/def2/.../
 *
 * @param {string} line
 * @returns {{traditional: string, simplified: string, pinyin: string, definitions: string[]} | null}
 */
export function parseCedictLine(line) {
  if (line.startsWith("#") || line.trim() === "") return null;

  const match = line.match(/^(.+?)\s+(.+?)\s+\[(.+?)\]\s+\/(.+)\/\s*$/);
  if (!match) return null;

  const [, traditional, simplified, pinyin, defsRaw] = match;
  const definitions = defsRaw.split("/").filter((d) => d.trim());

  return { traditional, simplified, pinyin, definitions };
}

/**
 * Load CC-CEDICT into a Map keyed by simplified Chinese.
 * Keeps only the first occurrence of each word.
 *
 * @param {string} [cedictPath]
 * @returns {Promise<Map<string, {traditional: string, simplified: string, pinyin: string, definitions: string[]}>>}
 */
export async function loadCedict(cedictPath = CEDICT_PATH) {
  const map = new Map();

  const fileStream = fs.createReadStream(cedictPath, { encoding: "utf8" });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const entry = parseCedictLine(line);
    if (entry && !map.has(entry.simplified)) {
      map.set(entry.simplified, entry);
    }
  }

  return map;
}

/**
 * Convert numbered pinyin (e.g., "bu4 hui4") to tone marks (e.g., "bù huì")
 *
 * @param {string} pinyin
 * @returns {string}
 */
export function numericToToneMarks(pinyin) {
  const toneMap = {
    a: ["ā", "á", "ǎ", "à", "a"],
    e: ["ē", "é", "ě", "è", "e"],
    i: ["ī", "í", "ǐ", "ì", "i"],
    o: ["ō", "ó", "ǒ", "ò", "o"],
    u: ["ū", "ú", "ǔ", "ù", "u"],
    ü: ["ǖ", "ǘ", "ǚ", "ǜ", "ü"],
    v: ["ǖ", "ǘ", "ǚ", "ǜ", "ü"],
  };

  return pinyin
    .split(" ")
    .map((syllable) => {
      const toneMatch = syllable.match(/(\d)$/);
      if (!toneMatch) return syllable;

      const tone = parseInt(toneMatch[1], 10);
      let base = syllable.slice(0, -1).toLowerCase();

      base = base.replace(/u:/g, "ü").replace(/v/g, "ü");

      const vowelOrder = ["a", "e", "ou", "o", "iu", "ui", "i", "u", "ü"];

      for (const v of vowelOrder) {
        if (base.includes(v)) {
          const targetVowel = v.length > 1 ? v[v.length - 1] : v;
          if (toneMap[targetVowel] && tone >= 1 && tone <= 5) {
            base = base.replace(targetVowel, toneMap[targetVowel][tone - 1]);
          }
          break;
        }
      }

      return base;
    })
    .join(" ");
}
