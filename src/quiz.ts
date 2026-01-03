import type { Knex } from "knex";
import type {
  SentenceTatoeba,
  Word,
  WordAdditional,
} from "knex/types/tables.js";
import nodejieba from "nodejieba";

interface QuizSentence {
  id: number;
  zh: string;
  en: string;
  has_audio: boolean;
  audio_id?: number;
  components: WordComponent[];
}

interface WordComponent {
  text: string;
  punctuation: boolean;
  pinyin?: string;
}

// CJK Unified Ideographs: U+4E00 to U+9FFF
export const isCJK = (char: string) => {
  const code = char.charCodeAt(0);
  return code >= 0x4e00 && code <= 0x9fff;
};

// Chinese punctuation marks
export const CHINESE_PUNCTUATION = new Set([
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

export const isChinesePunctuation = (char: string) => {
  return CHINESE_PUNCTUATION.has(char);
};

export const hasASCII = (str: string) => {
  return /[A-Za-z0-9]/.test(str);
};

export const getTatoeabaSentence = async (
  knex: Knex,
): Promise<Omit<QuizSentence, "components"> | undefined> => {
  const sentence = await knex<SentenceTatoeba>("sentences_tatoeba")
    .select("*")
    .orderByRaw(knex.raw("random()"))
    .limit(1);
  if (sentence.length !== 1 || !sentence[0]) {
    console.error(`ERROR: Bad db call: ${JSON.stringify(sentence)}`);
    return undefined;
  }
  return {
    id: sentence[0].id,
    zh: sentence[0].zh,
    en: sentence[0].en,
    has_audio: false,
  };
};

export const getRandomSentence = async (
  knex: Knex,
): Promise<QuizSentence | undefined> => {
  const MAX_ATTEMPTS = 10;
  let attempt = 0;
  while (attempt < MAX_ATTEMPTS) {
    const sentence = await getTatoeabaSentence(knex);
    // TODO: handle ASCII mixed with Chinese. For now, just skip such sentences.
    if (!sentence || hasASCII(sentence.zh)) {
      attempt++;
      continue;
    }
    const components = [];
    const segments = nodejieba.cut(sentence.zh);
    for (const segment of segments) {
      if (isChinesePunctuation(segment)) {
        components.push({
          text: segment,
          punctuation: true,
        });
      } else if (await existsInWordLists(knex, segment)) {
        components.push(await getWordComponent(knex, segment));
      } else {
        // Try character-by-character fallback for multi-character segments
        if (segment.length > 1) {
          console.log(
            `Segment not found: ${segment}, trying character-by-character`,
          );
          let allFound = true;
          const charWords = [];

          for (const char of segment) {
            if (await existsInWordLists(knex, char)) {
              charWords.push(await getWordComponent(knex, char));
            } else {
              allFound = false;
              break;
            }
          }

          if (allFound) {
            console.log(`Parsed as individual characters: ${segment}`);
            components.push(...charWords);
            continue;
          }
        }

        // Try quantity + measure word pattern (e.g., 十分钟 = 十 + 分钟)
        if (segment.length >= 2) {
          let foundQuantity = false;
          // Try splitting first char(s) as number + rest as measure word
          for (let i = 1; i < segment.length; i++) {
            const numPart = segment.slice(0, i);
            const measurePart = segment.slice(i);

            if (
              (await existsInWordLists(knex, numPart)) &&
              (await existsInWordLists(knex, measurePart))
            ) {
              console.log(`Parsed as quantity: ${numPart} + ${measurePart}`);
              components.push(
                await getWordComponent(knex, numPart),
                await getWordComponent(knex, measurePart),
              );
              foundQuantity = true;
              break;
            }
          }

          if (foundQuantity) continue;
        }
      }
    }
    const reconstructed = components.map((c) => c.text).join("");
    if (reconstructed === sentence.zh) {
      return {
        ...sentence,
        components,
      };
    } else {
      console.warn(
        `Reconstruction mismatch: original="${sentence.zh}", reconstructed="${reconstructed}"`,
      );
    }
    attempt++;
  }
  console.error(`Failed to get valid sentence after ${MAX_ATTEMPTS} attempts`);
  return undefined;
};

export const existsInWordLists = async (
  knex: Knex,
  word: string,
): Promise<boolean> => {
  const countResult = await knex<Word>("words_hsk")
    .count<{ count: number }>("id as count")
    .where("simplified_zh", word)
    .first();

  if (countResult && countResult.count > 0) {
    return true;
  }

  const additionalCountResult = await knex<WordAdditional>("words_additional")
    .count<{ count: number }>("id as count")
    .where("simplified_zh", word)
    .first();

  return (additionalCountResult?.count ?? 0) > 0;
};

export const getWordComponent = async (
  knex: Knex,
  word: string,
): Promise<WordComponent> => {
  const hskWord = await knex<Word>("words_hsk")
    .where("simplified_zh", word)
    .first();
  if (hskWord) {
    return {
      text: word,
      pinyin: (JSON.parse(hskWord.pinyin) as string[])[0] ?? "",
      punctuation: false,
    };
  } else {
    const additionalWord = await knex<WordAdditional>("words_additional")
      .where("simplified_zh", word)
      .first();
    if (additionalWord) {
      return {
        text: word,
        pinyin: additionalWord.pinyin,
        punctuation: false,
      };
    }
  }
  throw new Error(`Word not found in database: ${word}`);
};
