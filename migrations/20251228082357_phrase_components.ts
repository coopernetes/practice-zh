import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable("phrase_components")) {
    return;
  }
  await knex.schema.createTable("phrase_components", (table) => {
    table.increments("id").primary();
    table
      .integer("phrase_id")
      .references("id")
      .inTable("phrases")
      .onDelete("CASCADE");
    table.integer("word_id").references("id").inTable("words");

    table.string("slot_key"); // e.g., 'subj', 'verb_1', 'measure'
    table.integer("position").notNullable(); // Order of display
    table.boolean("is_optional").defaultTo(false); // For words like '很'
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists("phrase_components");
}
