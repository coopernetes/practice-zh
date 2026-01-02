/**
 * Database utilities for scripts
 *
 * Shared database access for the data pipeline scripts.
 */

import knex from "knex";

const DB_PATH = "./practice-zh.sqlite3";

/**
 * Create a database connection
 * @returns {import('knex').Knex}
 */
export function createDb() {
  return knex({
    client: "better-sqlite3",
    connection: { filename: DB_PATH },
    useNullAsDefault: true,
  });
}

/**
 * Load all known vocabulary into a Set for O(1) lookup.
 * Combines words from both HSK and additional vocabulary tables.
 *
 * @param {import('knex').Knex} db
 * @returns {Promise<Set<string>>}
 */
export async function loadKnownWords(db) {
  const known = new Set();

  const hskWords = await db("words_hsk").select("simplified_zh");
  for (const row of hskWords) {
    known.add(row.simplified_zh);
  }

  const additionalWords = await db("words_additional").select("simplified_zh");
  for (const row of additionalWords) {
    known.add(row.simplified_zh);
  }

  return known;
}

/**
 * Get count of words in each table
 * @param {import('knex').Knex} db
 */
export async function getWordCounts(db) {
  const [hsk] = await db("words_hsk").count("* as count");
  const [additional] = await db("words_additional").count("* as count");
  return {
    hsk: hsk.count,
    additional: additional.count,
    total: hsk.count + additional.count,
  };
}

/**
 * Get count of sentences
 * @param {import('knex').Knex} db
 */
export async function getSentenceCount(db) {
  const [result] = await db("sentences_tatoeba").count("* as count");
  return result.count;
}
