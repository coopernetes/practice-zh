import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  if (
    (await knex.schema.hasTable("sentences_custom")) ||
    (await knex.schema.hasTable("sentences_custom_audio"))
  ) {
    return;
  }

  await knex.schema.createTable("sentences_custom", (table) => {
    table.increments("id").primary();
    table.text("zh").notNullable();
    table.text("en").notNullable();
    table.integer("zh_id").nullable();
    table.integer("en_id").nullable();
  });

  await knex.schema.createTable("sentences_custom_audio", (table) => {
    table.increments("id").primary();
    table.integer("zh_id").notNullable();
    table.binary("audio_blob").notNullable();
    table.string("source").notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
    table.unique(["zh_id", "source"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("sentences_custom");
  await knex.schema.dropTableIfExists("sentences_custom_audio");
}
