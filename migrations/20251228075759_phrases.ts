import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable("phrases")) {
    return;
  }
  return knex.schema.createTable("phrases", (table) => {
    table.increments("id").primary();
    table.string("english_text").notNullable();
    table.string("pattern_type"); // e.g., 'svo', 'adj_predicate', 'serial_verb', 'yes_no_q', etc.
    table.string("template_string").notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists("phrases");
}
