import type { Knex } from "knex";
import type { FastifyPluginAsync } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    knex: Knex;
  }
}

declare module "knex/types/tables.js" {
  interface Word {
    id: number;
    hsk2_level?: number;
    hsk3_level?: number;
    simplified_zh: string;
    traditional_zh: string;
    pinyin: string;
    pinyin_numeric: string;
    part_of_speech: string; // JSON array of strings
    meanings: string; // JSON array
    frequency: number;
  }

  interface WordAdditional {
    id: number;
    simplified_zh: string;
    traditional_zh: string;
    pinyin: string;
    pinyin_numeric: string;
    english: string; // JSON array of definitions
    hsk_approx: string; // e.g., "1-3", "4", "5", "6"
    source: string; // "missing" or "delayed"
    created_at: Date;
  }

  interface SentenceTatoeba {
    id: number;
    zh: string;
    en: string;
    zh_id: number;
    en_id: number;
  }

  interface SentenceTatoebaAudio {
    id: number;
    zh_id: number;
    audio_blob: Buffer;
    source: string;
    created_at: Date;
  }

  interface SentenceCustom {
    id: number;
    zh: string;
    en: string;
    zh_id?: number;
    en_id?: number;
  }

  interface SentenceCustomAudio {
    id: number;
    zh_id: number;
    audio_blob: Buffer;
    source: string;
    created_at: Date;
  }

  interface Phrase {
    id: number;
    en_text: string;
    pattern_type?: string; // e.g., 'svo', 'adj_predicate', 'serial_verb', 'yes_no_q', etc.
    template_string: string;
  }

  interface PhraseComponent {
    id: number;
    phrase_id: number;
    word_id?: number;
    literal_zh?: string;
    slot_key: string;
    position: number;
    is_optional: boolean;
  }

  interface User {
    id: number;
    user_name: string;
    email: string;
    password_hash: string;
    salt: string;
    created_at: Date;
    password_expires_at: Date;
    settings: UserSettings;
  }

  interface UserSettings {
    unknown_word_threshold?: number;
    enable_audio?: boolean;
    enable_word_banks?: boolean;
    ui_language?: "en" | "zh" | "system";
    ui_theme?: "light" | "dark" | "system";
  }

  interface UserBank {
    id: number;
    user_id: number;
    name: string;
    tags: string;
  }

  interface UserBankWordHsk {
    id: number;
    word_hsk_id: number;
    bank_id: number;
  }

  interface UserBankWordAdditional {
    id: number;
    word_additional_id: number;
    bank_id: number;
  }

  interface Tables {
    words_hsk: Word;
    words_hsk_composite: Knex.CompositeTableType<Word, Omit<Word, "id">>;
    words_additional: WordAdditional;
    words_additional_composite: Knex.CompositeTableType<
      WordAdditional,
      Omit<WordAdditional, "id" | "created_at">
    >;
    sentences_tatoeba: SentenceTatoeba;
    sentences_tatoeba_composite: Knex.CompositeTableType<
      SentenceTatoeba,
      Omit<SentenceTatoeba, "id">
    >;
    sentences_tatoeba_audio: SentenceTatoebaAudio;
    sentences_tatoeba_audio_composite: Knex.CompositeTableType<
      SentenceTatoebaAudio,
      Omit<SentenceTatoebaAudio, "id" | "created_at">
    >;
    sentences_custom: SentenceCustom;
    sentences_custom_composite: Knex.CompositeTableType<
      SentenceCustom,
      Omit<SentenceCustom, "id">
    >;
    sentences_custom_audio: SentenceCustomAudio;
    sentences_custom_audio_composite: Knex.CompositeTableType<
      SentenceCustomAudio,
      Omit<SentenceCustomAudio, "id" | "created_at">
    >;
    phrases: Phrase;
    phrases_composite: Knex.CompositeTableType<Phrase, Omit<Phrase, "id">>;
    phrase_components: PhraseComponent;
    phrase_components_composite: Knex.CompositeTableType<
      PhraseComponent,
      Omit<PhraseComponent, "id">
    >;
    user_banks: UserBank;
    user_banks_composite: Knex.CompositeTableType<
      UserBank,
      Omit<UserBank, "id">
    >;
    users: User;
    users_composite: Knex.CompositeTableType<
      User,
      Omit<User, "id" | "created_at" | "password_expires_at">
    >;
    user_bank_words_hsk: UserBankWordHsk;
    user_bank_words_hsk_composite: Knex.CompositeTableType<
      UserBankWordHsk,
      Omit<UserBankWordHsk, "id">
    >;
    user_bank_words_additional: UserBankWordAdditional;
    user_bank_words_additional_composite: Knex.CompositeTableType<
      UserBankWordAdditional,
      Omit<UserBankWordAdditional, "id">
    >;
  }
}

let knexInstance: Knex | null = null;

export const getKnex = (): Knex => {
  if (!knexInstance) {
    throw new Error("Knex instance has not been initialized.");
  }
  return knexInstance;
};

export const setKnex = (knex: Knex): void => {
  knexInstance = knex;
};

export const knexPlugin: FastifyPluginAsync<{}> = async (instance, {}) => {
  const knex = getKnex();
  instance.decorate("knex", knex);

  instance.addHook("onClose", (instance, done) => {
    instance.knex.destroy(done);
  });
};
