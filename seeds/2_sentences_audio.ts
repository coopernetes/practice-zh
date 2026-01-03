import type { Knex } from "knex";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex("sentences_custom_audio").del();
  await knex("sentences_tatoeba_audio").del();

  const audioDir = "misc/audio";
  const audioFiles = readdirSync(audioDir).filter((f) => f.endsWith(".ogg"));

  // Process custom sentence audio files
  const customAudioFiles = audioFiles.filter((f) =>
    f.startsWith("sentences_custom_"),
  );
  for (const audioFile of customAudioFiles) {
    const match = audioFile.match(/sentences_custom_(\d+)\.ogg$/);
    if (!match) continue;

    const sentenceId = parseInt(match[1], 10);
    const sentence = await knex("sentences_custom")
      .where({ id: sentenceId })
      .first();

    if (!sentence) {
      console.warn(
        `Custom sentence with ID ${sentenceId} not found, skipping audio file: ${audioFile}`,
      );
      continue;
    }

    await knex("sentences_custom_audio").insert({
      sentence_id: sentenceId,
      audio_blob: Buffer.from(readFileSync(join(audioDir, audioFile))),
      source: "qwen3-tts-flash",
    });
  }

  // Process tatoeba sentence audio files
  const tatoebaAudioFiles = audioFiles.filter((f) =>
    f.startsWith("sentences_tatoeba_"),
  );
  for (const audioFile of tatoebaAudioFiles) {
    const match = audioFile.match(/sentences_tatoeba_(\d+)\.ogg$/);
    if (!match) continue;

    const sentenceId = parseInt(match[1], 10);
    const sentence = await knex("sentences_tatoeba")
      .where({ id: sentenceId })
      .first();

    if (!sentence) {
      console.warn(
        `Tatoeba sentence with ID ${sentenceId} not found, skipping audio file: ${audioFile}`,
      );
      continue;
    }

    await knex("sentences_tatoeba_audio").insert({
      sentence_id: sentenceId,
      audio_blob: Buffer.from(readFileSync(join(audioDir, audioFile))),
      source: "qwen3-tts-flash",
    });
  }

  console.log(
    `Seeded ${customAudioFiles.length} custom audio files and ${tatoebaAudioFiles.length} tatoeba audio files`,
  );
}
