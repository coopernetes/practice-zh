import type { Knex } from "knex";
import { readFileSync, existsSync } from "node:fs";

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex("sentences_custom_audio").del();
  await knex("sentences_tatoeba_audio").del();

  // Get the ID of the custom sentence "今天很冷"
  const customSentence = await knex("sentences_custom")
    .where({ zh: "今天很冷" })
    .first();

  const audioPath = "misc/audio/sentences_custom_1.ogg";
  if (!existsSync(audioPath)) {
    console.warn(
      `Audio file does not exist: ${audioPath}, skipping seed of custom sentence audio.`
    );
  } else {
    await knex("sentences_custom_audio").insert([
      {
        sentence_id: customSentence.id,
        audio_blob: Buffer.from(readFileSync(audioPath)),
        source: "qwen3-tts-flash",
      },
    ]);
  }

  if (
    !existsSync("misc/audio/sentences_tatoeba_45924.ogg") ||
    !existsSync("misc/audio/sentences_tatoeba_28068.ogg")
  ) {
    console.warn(
      `One or more Tatoeba audio files do not exist, skipping seed of Tatoeba sentence audio.`
    );
    return;
  }
  // two test sentences are used with audio
  // they are the same spoken Chinese sentence but with different English translations
  const ids1 = [636, 637, 45924, 45925];
  const ids2 = [28068, 68303];
  await knex("sentences_tatoeba_audio").insert([
    ...ids1.map((id) => ({
      sentence_id: id,
      audio_blob: Buffer.from(
        readFileSync(`misc/audio/sentences_tatoeba_45924.ogg`)
      ),
      source: "qwen3-tts-flash",
    })),
    ...ids2.map((id) => ({
      sentence_id: id,
      audio_blob: Buffer.from(
        readFileSync(`misc/audio/sentences_tatoeba_28068.ogg`)
      ),
      source: "qwen3-tts-flash",
    })),
    {
      sentence_id: 49233,
      audio_blob: Buffer.from(
        readFileSync(`misc/audio/sentences_tatoeba_49233.ogg`)
      ),
      source: "qwen3-tts-flash",
    },
  ]);
}
