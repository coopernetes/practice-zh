import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  if (
    (await knex.schema.hasTable("sentences_tatoeba")) ||
    (await knex.schema.hasTable("sentences_tatoeba_audio"))
  ) {
    return;
  }

  await knex.schema.createTable("sentences_tatoeba", (table) => {
    table.increments("id").primary();
    table.text("zh").notNullable();
    table.text("en").notNullable();
    table.integer("zh_id").notNullable();
    table.integer("en_id").notNullable();
  });

  await knex.schema.createTable("sentences_tatoeba_audio", (table) => {
    table.increments("id").primary();
    table.integer("zh_id").notNullable();
    table.binary("audio_blob").notNullable();
    table.string("source").notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
    table.unique(["zh_id", "source"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("sentences_tatoeba_audio");
  await knex.schema.dropTableIfExists("sentences_tatoeba");
}
