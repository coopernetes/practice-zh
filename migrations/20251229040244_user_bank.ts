import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  if (
    (await knex.schema.hasTable("user_banks")) ||
    (await knex.schema.hasTable("user_bank_words_hsk")) ||
    (await knex.schema.hasTable("user_bank_words_additional")) ||
    (await knex.schema.hasTable("users"))
  ) {
    return;
  }
  await knex.schema.createTable("users", (table) => {
    table.increments("id").primary();
    table.string("user_name").notNullable();
    table.string("email").notNullable();
  });
  await knex.schema.createTable("user_banks", (table) => {
    table.increments("id").primary();
    table
      .integer("user_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table.string("name").notNullable();
    table.text("tags");
  });
  await knex.schema.createTable("user_bank_words_hsk", (table) => {
    table.increments("id").primary();
    table
      .integer("word_hsk_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("words_hsk")
      .onDelete("CASCADE");
    table
      .integer("bank_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("user_banks")
      .onDelete("CASCADE");
    table.unique(["word_hsk_id", "bank_id"]);
  });
  await knex.schema.createTable("user_bank_words_additional", (table) => {
    table.increments("id").primary();
    table
      .integer("word_additional_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("words_additional")
      .onDelete("CASCADE");
    table
      .integer("bank_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("user_banks")
      .onDelete("CASCADE");
    table.unique(["word_additional_id", "bank_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("user_bank_words_additional");
  await knex.schema.dropTableIfExists("user_bank_words_hsk");
  await knex.schema.dropTableIfExists("user_banks");
}
