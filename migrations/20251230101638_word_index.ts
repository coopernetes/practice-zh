import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(
    `CREATE INDEX IF NOT EXISTS word_chinese_chars_index ON words (simplified_zh);`
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`DROP INDEX IF EXISTS word_chinese_chars_index;`);
}
