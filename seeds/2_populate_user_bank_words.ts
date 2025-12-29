import type { Knex } from "knex";
import { readFileSync } from "node:fs";

const input = process.env.USER_BANK_JSON || "misc/user_bank.json";

interface BankEntry {
  name: string;
  characters: string[];
  tags: string[];
}

interface BankTable {
  id: number;
  user_id: number;
  name: string;
  tags: string;
}

interface WordRow {
  id: number;
  simplified: string;
}

interface BankWordTable {
  word_id: number;
  bank_id: number;
}

export async function seed(knex: Knex): Promise<void> {
  const userInsert = await knex
    .insert<{ id: number; user_name: string; email: string }>({
      user_name: "default_user",
      email: "user@example.com",
    })
    .returning<Pick<{ id: number; user_name: string; email: string }, "id">[]>(
      "id"
    )
    .into("users");

  const fileContents = readFileSync(input, "utf-8");
  const entries: BankEntry[] = JSON.parse(fileContents);

  const inserts: BankTable[] = [];
  const wordInserts: BankWordTable[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const bankInsert = await knex
      .insert<BankTable>({
        name: entry.name,
        tags: JSON.stringify(entry.tags),
        user_id: userInsert[0].id,
      })
      .returning<Pick<BankTable, "id">[]>("id")
      .into("user_banks");
    const wordIds = await knex
      .select("id")
      .from("words")
      .whereIn("simplified_chars", entry.characters);
    wordIds.forEach((wordId) => {
      wordInserts.push({
        word_id: wordId.id,
        bank_id: bankInsert[0].id,
      });
    });
  }
  await knex.batchInsert("user_banks", inserts, 100);
  await knex.batchInsert("user_bank_words", wordInserts, 100);
}
