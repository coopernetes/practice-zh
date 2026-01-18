import fastify from "fastify";
import { getKnex } from "../db.js";
import {
  getSentenceById,
  getRandomSentence,
  getSentenceTatoebaAudio,
} from "../corpus.js";

export const apiRoutes = async (fastify: fastify.FastifyInstance) => {
  fastify.get("/api/audio/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const audio = await getSentenceTatoebaAudio(getKnex(), parseInt(id, 10));
    return reply.type("audio/ogg; codecs=vorbis").send(audio);
  });

  fastify.get("/api/sentence", async (request, reply) => {
    const id = (request.query as { id?: number }).id;
    const sentence = id
      ? await getSentenceById(getKnex(), id)
      : await getRandomSentence(getKnex());
    if (!sentence) {
      return reply.code(404).send({ error: "Sentence not found" });
    }
    return reply.send(sentence);
  });
};
