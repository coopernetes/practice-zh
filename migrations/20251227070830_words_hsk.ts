import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable("words_hsk")) {
    return;
  }
  await knex.schema.createTable("words_hsk", (table) => {
    table.increments("id").primary();
    table.string("simplified_zh").notNullable();
    table.string("traditional_zh").notNullable();
    table.string("pinyin").notNullable();
    table.string("pinyin_numeric").notNullable();
    table.text("meanings").notNullable();
    table.text("part_of_speech").notNullable();
    table.integer("frequency").notNullable();
    table.integer("hsk2_level").nullable();
    table.integer("hsk3_level").nullable();
  });

  await knex.schema.raw(
    `CREATE INDEX IF NOT EXISTS words_hsk_zh_index ON words_hsk (simplified_zh);`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`DROP INDEX IF EXISTS words_hsk_zh_index;`);
  return knex.schema.dropTableIfExists("words_hsk");
}
