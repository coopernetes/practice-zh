import type { Knex } from "knex";
import type { SentenceTatoeba } from "knex/types/tables.js";

interface QuizSentence {
  id: number;
  zh: string;
  en: string;
  has_audio: boolean;
  audio_id?: number;
}

export const getRandomSentence = async (
  knex: Knex
): Promise<QuizSentence | undefined> => {
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
