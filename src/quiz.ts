import { getKnex } from "./db.js";

export const getPhrase = async (phraseId: number) => {
  const knex = getKnex();
  const phrase = await knex("phrases").where({ id: phraseId }).first();
  if (!phrase) {
    throw new Error(`Phrase with ID ${phraseId} not found.`);
  }

  const components = await knex("phrase_components")
    .where({ phrase_id: phraseId })
    .orderBy("position", "asc");

  return {
    ...phrase,
    components,
  };
};
