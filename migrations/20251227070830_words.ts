import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable("words")) {
    return;
  }
  return knex.schema.createTable("words", (table) => {
    table.increments("id").primary();
    table.string("simplified_chars").notNullable();
    table.string("traditional_chars").notNullable();
    table.string("pinyin").notNullable();
    table.string("pinyin_numeric").notNullable();
    table.text("meanings").notNullable();
    table.text("part_of_speech").notNullable();
    table.integer("frequency").notNullable();
    table.integer("hsk2_level").nullable();
    table.integer("hsk3_level").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists("words");
}
