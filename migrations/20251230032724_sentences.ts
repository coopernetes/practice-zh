import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable("sentences")) {
    return;
  }
  await knex.schema.createTable("sentences", (table) => {
    table.increments("id").primary();
    table.text("chinese").notNullable();
    table.integer("chinese_sentence_id").notNullable();
    table.text("english").notNullable();
    table.integer("english_sentence_id").notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("sentences");
}
