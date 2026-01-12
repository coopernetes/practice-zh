import type { Knex } from "knex";
import { readFileSync } from "node:fs";
import { randomBytes, pbkdf2Sync } from "node:crypto";

const input = process.env.SEED_USER_BANK_JSON || "data/custom/user_bank.json";

interface BankEntry {
  name: string;
  words: string[];
  tags: string[];
}

interface BankTable {
  id: number;
  user_id: number;
  name: string;
  tags: string;
}

interface BankWordHskTable {
  word_hsk_id: number;
  bank_id: number;
}

interface BankWordAdditionalTable {
  word_additional_id: number;
  bank_id: number;
}

const TEST_PASSWORD = "abcdef123456".normalize();
const TEST_SALT = Buffer.from(randomBytes(16)).toString("hex");
const TEST_PASSWORD_HASH = pbkdf2Sync(
  TEST_PASSWORD,
  TEST_SALT,
  10000,
  64,
  "sha512",
).toString("hex");

export async function seed(knex: Knex): Promise<void> {
  await knex("user_bank_words_additional").del();
  await knex("user_bank_words_hsk").del();
  await knex("user_banks").del();
  await knex("users").del();

  const userInsert = await knex
    .insert<{ id: number; user_name: string; email: string }>({
      user_name: "default_user",
      email: "user@example.com",
      password_hash: TEST_PASSWORD_HASH,
      salt: TEST_SALT,
      created_at: knex.fn.now(),
      password_expires_at: knex.raw("(datetime('now', '+30 days'))"),
    })
    .returning<Pick<{ id: number; user_name: string; email: string }, "id">[]>(
      "id",
    )
    .into("users");

  const fileContents = readFileSync(input, "utf-8");
  const entries: BankEntry[] = JSON.parse(fileContents);

  const inserts: BankTable[] = [];
  const wordHskInserts: BankWordHskTable[] = [];
  const wordAdditionalInserts: BankWordAdditionalTable[] = [];

  for (const entry of entries) {
    const bankInsert = await knex
      .insert<BankTable>({
        name: entry.name,
        tags: JSON.stringify(entry.tags),
        user_id: userInsert[0].id,
      })
      .returning<Pick<BankTable, "id">[]>("id")
      .into("user_banks");

    // Check words_hsk
    const hskWords = await knex
      .select(["id", "simplified_zh"])
      .from("words_hsk")
      .whereIn("simplified_zh", entry.words);

    // Check words_additional
    const additionalWords = await knex
      .select(["id", "simplified_zh"])
      .from("words_additional")
      .whereIn("simplified_zh", entry.words);

    const foundWords = new Set([
      ...hskWords.map((w) => w.simplified_zh),
      ...additionalWords.map((w) => w.simplified_zh),
    ]);
    const missing = entry.words.filter((word) => !foundWords.has(word));
    if (missing.length > 0) {
      console.warn(
        `Warning: Some words in bank "${entry.name}" were not found.`,
      );
      console.warn(`Missing words: ${missing.join(", ")}`);
    }

    hskWords.forEach((wordId) => {
      wordHskInserts.push({
        word_hsk_id: wordId.id,
        bank_id: bankInsert[0].id,
      });
    });

    additionalWords.forEach((wordId) => {
      wordAdditionalInserts.push({
        word_additional_id: wordId.id,
        bank_id: bankInsert[0].id,
      });
    });
  }

  await knex.batchInsert("user_banks", inserts, 100);
  if (wordHskInserts.length > 0) {
    await knex.batchInsert("user_bank_words_hsk", wordHskInserts, 100);
  }
  if (wordAdditionalInserts.length > 0) {
    await knex.batchInsert(
      "user_bank_words_additional",
      wordAdditionalInserts,
      100,
    );
  }
}
