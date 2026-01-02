import type { Knex } from "knex";
import { readFileSync, existsSync } from "node:fs";

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex("sentences_custom_audio").del();

  // Get the ID of the custom sentence "今天很冷"
  const customSentence = await knex("sentences_custom")
    .where({ zh: "今天很冷" })
    .first();

  if (!customSentence) {
    console.log("Custom sentence not found, skipping audio seed");
    return;
  }

  const audioPath = "misc/audio/sentences_custom_1.ogg";
  if (!existsSync(audioPath)) {
    console.log(`Audio file ${audioPath} not found, skipping`);
    return;
  }

  // Inserts seed entries
  await knex("sentences_custom_audio").insert([
    {
      sentence_id: customSentence.id,
      audio_blob: Buffer.from(readFileSync(audioPath)),
      source: "qwen3-tts-flash",
    },
  ]);

  console.log(`Inserted audio for sentence ID ${customSentence.id}`);
}
