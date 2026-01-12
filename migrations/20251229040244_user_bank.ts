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
  const client = knex.client.config.client;
  let passwordExpiresDefault;
  if (client === "better-sqlite3") {
    passwordExpiresDefault = knex.raw("(datetime('now', '+30 days'))");
  } else if (client === "pg") {
    passwordExpiresDefault = knex.raw("(NOW() + INTERVAL '30 days')");
  } else {
    throw new Error(`Unsupported DB client: ${client}`);
  }
  await knex.schema.createTable("users", (table) => {
    table.increments("id").primary();
    table.string("user_name").notNullable();
    table.string("email").notNullable();
    table.string("password_hash").notNullable();
    table.string("salt").notNullable();
    table.dateTime("created_at").notNullable().defaultTo(knex.fn.now());
    table
      .dateTime("password_expires_at")
      .notNullable()
      .defaultTo(passwordExpiresDefault);
    table.unique("email");
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
