import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable("sentences_tatoeba")) {
    return;
  }
  await knex.schema.createTable("sentences_tatoeba", (table) => {
    table.increments("id").primary();
    table.text("zh").notNullable();
    table.text("en").notNullable();
    table.integer("zh_id").nullable();
    table.integer("en_id").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("sentences_tatoeba");
}
