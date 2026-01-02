import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable("words_additional")) {
    return;
  }
  await knex.schema.createTable("words_additional", (table) => {
    table.increments("id").primary();
    table.string("simplified_zh").notNullable().unique();
    table.string("traditional_zh").notNullable();
    table.string("pinyin").notNullable();
    table.string("pinyin_numeric").notNullable();
    table.text("english").notNullable(); // JSON array of definitions
    table.string("hsk_approx").notNullable(); // e.g., "1-3", "4", "5", "6"
    table.string("source").notNullable(); // "missing" or "delayed"
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });

  await knex.schema.raw(
    `CREATE INDEX IF NOT EXISTS words_additional_zh_index ON words_additional (simplified_zh);`
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`DROP INDEX IF EXISTS words_additional_zh_index;`);
  return knex.schema.dropTableIfExists("words_hsk_missing");
}
