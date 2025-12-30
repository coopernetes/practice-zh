import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable("sentences")) {
    return;
  }
  await knex.schema.createTable("sentences", (table) => {
    table.increments("id").primary();
    table.text("zh").notNullable();
    table.integer("zh_id").notNullable();
    table.text("en").notNullable();
    table.integer("en_id").notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("sentences");
}
