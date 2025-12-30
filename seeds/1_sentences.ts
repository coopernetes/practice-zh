import type { Knex } from "knex";
import { open } from "node:fs/promises";

const sentenceTsv = process.env.SENTENCES_TSV || "misc/sentences.tsv";

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex("sentences").del();

  const sentences = [];
  let fileHandle;
  try {
    fileHandle = await open(sentenceTsv, "r");
    for await (const line of fileHandle.readLines({ encoding: "utf-8" })) {
      const lineToSplit = line.charAt(0) === "\uFEFF" ? line.slice(1) : line;
      const parts = lineToSplit.split("\t");
      sentences.push({
        chinese_sentence_id: parts[0], // These ids are from the original data source
        chinese: parts[1],
        english_sentence_id: parts[2], // These ids are from the original data source
        english: parts[3],
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }

  // Inserts seed entries
  await knex.batchInsert("sentences", sentences, 100);
}
