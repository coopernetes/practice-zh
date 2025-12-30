import { Knex } from "knex";

declare module "knex/types/tables.js" {
  interface Word {
    id: number;
    hsk2_level?: number;
    hsk3_level?: number;
    simplified_zh: string;
    // JSON array as string types
    traditional_zh: string;
    pinyin: string;
    pinyin_numeric: string;
    part_of_speech: string; // JSON array of strings
    // a 2 dimensional JSON array of strings. if traditional has more than one entry, meanings[i] corresponds to traditional_chars[i]
    meanings: string;
  }

  interface Phrase {
    id: number;
    english_text: string;
    pattern_type?: string; // e.g., 'svo', 'adj_predicate', 'serial_verb', 'yes_no_q', etc.
    template_string: string;
  }

  interface PhraseComponent {
    id: number;
    phrase_id: number;
    word_id: number;
    slot_key: string;
    position: number;
    is_optional: boolean;
  }

  interface User {
    id: number;
    user_name: string;
    email: string;
  }

  interface UserBank {
    id: number;
    user_id: number;
    name: string;
    tags: string;
  }

  interface UserBankWord {
    id: number;
    word_id: number;
    bank_id: number;
  }

  interface Tables {
    words: Word;
    words_composite: Knex.CompositeTableType<Word, Omit<Word, "id">>;
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
    user_bank_words: UserBankWord;
    user_bank_words_composite: Knex.CompositeTableType<
      UserBankWord,
      Omit<UserBankWord, "id">
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
