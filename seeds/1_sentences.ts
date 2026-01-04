import type { Knex } from "knex";
import { open } from "node:fs/promises";

const sentencesTatoeabaTsv =
  process.env.SEED_SENTENCES_TATOEBA_TSV ||
  "data/processed/sentences_tatoeba.simplified.tsv";
const sentencesCustomTsv =
  process.env.SEED_SENTENCES_CUSTOM_TSV || "data/custom/sentences_custom.tsv";

async function parseSentencesTsv(tsvPath: string) {
  const sentences = [];
  let fileHandle;
  try {
    fileHandle = await open(tsvPath, "r");
    for await (const line of fileHandle.readLines({ encoding: "utf-8" })) {
      const lineToSplit = line.charAt(0) === "\uFEFF" ? line.slice(1) : line;
      const parts = lineToSplit.split("\t");
      sentences.push({
        zh_id: parts[0],
        zh: parts[1],
        en_id: parts[2],
        en: parts[3],
      });
    }
  } catch (err) {
    // File may not exist, that's ok
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(err);
    }
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }
  return sentences;
}

export async function seed(knex: Knex): Promise<void> {
  // Always delete existing to prevent duplicates
  await knex("sentences_tatoeba").del();
  await knex("sentences_custom").del();

  const tatoeba = await parseSentencesTsv(sentencesTatoeabaTsv);
  if (tatoeba.length) {
    console.log(`Inserting ${tatoeba.length} tatoeba sentences...`);
    await knex.batchInsert("sentences_tatoeba", tatoeba, 100);
  }

  const custom = await parseSentencesTsv(sentencesCustomTsv);
  if (custom.length) {
    console.log(`Inserting ${custom.length} custom sentences...`);
    await knex.batchInsert("sentences_custom", custom, 100);
  }
}
