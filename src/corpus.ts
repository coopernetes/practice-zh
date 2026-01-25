import type { Knex } from "knex";
import type {
  SentenceTatoeba,
  Word,
  WordAdditional,
} from "knex/types/tables.js";
import nodejieba from "nodejieba";
import { hasASCII, isChinesePunctuation } from "./utils.js";

interface QuizSentence {
  id: number;
  zh: string;
  en: string;
  has_audio: boolean;
  components: WordComponent[];
  audio_id?: number | undefined;
}

interface WordComponent {
  text: string;
  punctuation: boolean;
  pinyin?: string;
}

export const getTatoebaSentence = async (
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
    const sentence = await getTatoebaSentence(knex);
    // TODO: handle ASCII mixed with Chinese. For now, just skip such sentences.
    if (!sentence || hasASCII(sentence.zh)) {
      attempt++;
      continue;
    }
    const components = await getComponentsForSentence(knex, sentence.zh);
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

export const getSentenceById = async (
  knex: Knex,
  id: number,
): Promise<QuizSentence | undefined> => {
  const sentence = await knex<SentenceTatoeba>("sentences_tatoeba")
    .select("*")
    .where("id", id)
    .first();
  if (!sentence) {
    console.error(`Sentence not found with id: ${id}`);
    return undefined;
  }
  const components = await getComponentsForSentence(knex, sentence.zh);
  const has_audio = await sentenceTatoebaHasAudio(knex, sentence.id);
  let audio_id = undefined;
  if (has_audio) {
    audio_id = await getSentenceTatoebaAudioId(knex, sentence.id);
  }
  return {
    id: sentence.id,
    zh: sentence.zh,
    en: sentence.en,
    has_audio,
    audio_id,
    components,
  };
};

export const getComponentsForSentence = async (
  knex: Knex,
  sentenceZh: string,
): Promise<WordComponent[]> => {
  const components: WordComponent[] = [];
  const segments = nodejieba.cut(sentenceZh);
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
  return components;
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

export const sentenceTatoebaHasAudio = async (
  knex: Knex,
  sentence_id: number,
) => {
  const sentence = await knex("sentences_tatoeba")
    .select("zh_id")
    .where("id", sentence_id)
    .first();

  if (!sentence?.zh_id) return false;

  const audioCountResult = await knex("sentences_tatoeba_audio")
    .count<{ count: number }>("id as count")
    .where("zh_id", sentence.zh_id)
    .first();

  return (audioCountResult?.count ?? 0) > 0;
};

export const getSentenceTatoebaAudioId = async (
  knex: Knex,
  sentence_id: number,
): Promise<number | undefined> => {
  const sentence = await knex("sentences_tatoeba")
    .select("zh_id")
    .where("id", sentence_id)
    .first();

  if (!sentence?.zh_id) return undefined;

  const audioEntry = await knex("sentences_tatoeba_audio")
    .select("id")
    .where("zh_id", sentence.zh_id)
    .first();

  return audioEntry ? audioEntry.id : undefined;
};

export const getSentenceTatoebaAudio = async (
  knex: Knex,
  id: number,
): Promise<Buffer | undefined> => {
  const audioEntry = await knex("sentences_tatoeba_audio")
    .select("audio_blob")
    .where("id", id)
    .first();

  return audioEntry ? Buffer.from(audioEntry.audio_blob) : undefined;
};

export interface UserBankWord {
  bank_id: number;
  simplified_zh: string;
  pinyin?: string;
  definitions?: string;
  source_type: "hsk" | "additional" | "not_found";
}

export const getUserBanks = async (
  knex: Knex,
  userId: number,
): Promise<{ id: number; name: string }[]> => {
  const banks = await knex("user_banks")
    .select("id", "name")
    .where("user_id", userId);
  return banks;
};

export const getUserBankWords = async (
  knex: Knex,
  userId: number,
): Promise<UserBankWord[]> => {
  const userWords = await knex.raw(
    `
SELECT
    w_hsk.id AS word_id,
    w_hsk.simplified_zh,
    w_hsk.pinyin,
    w_hsk.meanings AS definition,
    ubwh.bank_id,
    'hsk' AS source_type
FROM words_hsk AS w_hsk
JOIN user_bank_words_hsk ubwh ON w_hsk.id = ubwh.word_hsk_id
JOIN user_banks ub ON ubwh.bank_id = ub.id
WHERE ub.user_id = ?

UNION ALL

SELECT
    w_addl.id AS word_id,
    w_addl.simplified_zh,
    w_addl.pinyin,
    w_addl.english AS definition,
    ubwa.bank_id,
    'additional' AS source_type
FROM words_additional AS w_addl
JOIN user_bank_words_additional ubwa ON w_addl.id = ubwa.word_additional_id
JOIN user_banks ub ON ubwa.bank_id = ub.id
WHERE ub.user_id = ?`,
    [userId, userId],
  );

  function parsePinyin(pinyin: string): string {
    try {
      const parsed = JSON.parse(pinyin);
      if (Array.isArray(parsed)) return parsed.join(", ");
      return String(parsed);
    } catch {
      return pinyin; // fallback for plain string
    }
  }

  function parseDefinition(definition: string): string {
    try {
      const parsed = JSON.parse(definition);
      if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
        // 2D array: flatten and join
        return parsed.map((arr: string[]) => arr.join("; ")).join("; ");
      } else if (Array.isArray(parsed)) {
        // 1D array
        return parsed.join("; ");
      }
      return String(parsed);
    } catch {
      return definition;
    }
  }

  const words = userWords.map((row: any) => {
    return {
      bank_id: row.bank_id as number,
      source_type: row.source_type as "hsk" | "additional" | "not_found",
      simplified_zh: row.simplified_zh as string,
      pinyin: parsePinyin(row.pinyin),
      definitions: parseDefinition(row.definition),
    };
  });
  return words;
};

export const componentsSuitableForUser = async (
  knex: Knex,
  components: WordComponent[],
  userId: number,
) => {
  const user = await knex("users")
    .select("id", "settings")
    .where("id", userId)
    .first();

  if (!user) {
    console.error(`User not found with id: ${userId}`);
    return false;
  }
  const threshold = user.settings.unknown_word_threshold || 0;
  const wordBank = user.settings.enable_word_banks || false;
  if (!wordBank && threshold === 0) {
    return true;
  }
  const userWords = await knex.raw(
    `SELECT w_hsk.simplified_zh, 
FROM words_hsk AS w_hsk
JOIN user_bank_words_hsk ubwh ON w_hsk.id = ubwh.word_hsk_id
JOIN user_banks ub ON ubwh.bank_id = ub.id
WHERE ub.user_id = ? -- Replace with target User ID

UNION ALL

SELECT w_addl.simplified_zh, 
FROM words_additional AS w_addl
JOIN user_bank_words_additional ubwa ON w_addl.id = ubwa.word_additional_id
JOIN user_banks ub ON ubwa.bank_id = ub.id
WHERE ub.user_id = ?`,
    [userId, userId],
  );
  const userWordSet = new Set<string>(
    userWords.rows.map((row: any) => row.simplified_zh),
  );

  let unknownCount = 0;
  for (const component of components) {
    if (component.punctuation) {
      continue;
    }
    if (!userWordSet.has(component.text)) {
      unknownCount++;
    }
  }
  return (
    ((components.length - unknownCount) / components.length) * 100 >= threshold
  );
};
