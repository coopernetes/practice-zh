import fastify from "fastify";
import { getKnex } from "../db.js";
import {
  getSentenceById,
  getRandomSentence,
  getSentenceTatoebaAudio,
  getComponentsForSentence,
  componentsSuitableForUser,
} from "../corpus.js";

export const apiRoutes = async (fastify: fastify.FastifyInstance) => {
  fastify.get("/api/audio/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const audio = await getSentenceTatoebaAudio(getKnex(), parseInt(id, 10));
    return reply.type("audio/ogg; codecs=vorbis").send(audio);
  });

  fastify.get("/api/sentence", async (request, reply) => {
    const id = (request.query as { id?: number }).id;
    if (id) {
      const sentence = await getSentenceById(getKnex(), id);
      if (!sentence) {
        return reply.code(404).send({ error: "Sentence not found" });
      }
      return reply.send(sentence);
    }
    let attempts = 3;
    while (attempts !== 0) {
      const sentence = await getRandomSentence(getKnex());
      if (!sentence) {
        return reply.code(500).send({ error: "Failed to retrieve sentence" });
      }
      if (
        await componentsSuitableForUser(
          getKnex(),
          sentence.components,
          request.session.userId!,
        )
      ) {
        return reply.send(sentence);
      }
      attempts--;
    }
    return reply.code(404).send({ error: "No suitable sentence found" });
  });

  fastify.post("/api/user/settings", async (request, reply) => {
    const knex = getKnex();
    const body = request.body as any;
    const userId = request.session.userId;
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    const user = await knex("users")
      .select("id", "settings")
      .where("id", userId)
      .first();

    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }

    // Parse current settings from DB (JSON string)
    let currentSettings: any = {};
    try {
      currentSettings =
        typeof user.settings === "string"
          ? JSON.parse(user.settings)
          : user.settings || {};
    } catch (e) {}

    // Build new settings from flat form params
    const newSettings = {
      ...currentSettings,
      unknown_word_threshold: parseInt(body.unknown_word_threshold, 10),
      enable_audio: body.enable_audio === "true" || body.enable_audio === true,
      enable_word_banks:
        body.enable_word_banks === "true" || body.enable_word_banks === true,
      ui_language: body.ui_language,
      ui_theme: body.ui_theme,
    };

    await knex("users")
      .where("id", userId)
      .update({ settings: JSON.stringify(newSettings) as any });
    return reply.send({ status: "Settings updated" });
  });
};
