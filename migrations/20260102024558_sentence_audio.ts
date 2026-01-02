import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable("sentences_tatoeba_audio")) {
    return;
  }

  await knex.schema.createTable("sentences_tatoeba_audio", (table) => {
    table.increments("id").primary();
    table
      .integer("sentence_id")
      .notNullable()
      .references("id")
      .inTable("sentences_tatoeba")
      .onDelete("CASCADE");
    table.binary("audio_blob").notNullable();
    table.string("source").notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
    table.unique(["sentence_id", "source"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("sentences_tatoeba_audio");
}
