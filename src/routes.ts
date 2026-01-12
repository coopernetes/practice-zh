import fastify from "fastify";
import {
  getWordComponent,
  getRandomSentence,
  getSentenceById,
  getSentenceTatoebaAudio,
} from "./quiz.js";
import { getKnex } from "./db.js";

const layoutForHtmx = (request: fastify.FastifyRequest) => {
  const isHtmx = !!request.headers["hx-request"];
  return isHtmx ? undefined : "layout.ejs";
};

export const routes = async (fastify: fastify.FastifyInstance) => {
  /**
   * UI Routes
   */
  fastify.get("/", async (request, reply) => {
    const layout = layoutForHtmx(request);
    return reply.view("index.ejs", { title: "Home" }, layout ? { layout } : {});
  });

  fastify.get("/quiz", async (request, reply) => {
    const layout = layoutForHtmx(request);
    return reply.view(
      "quiz.ejs",
      {
        userAgent: request.headers["user-agent"],
        time: new Date().toISOString(),
      },
      layout ? { layout } : {},
    );
  });

  // Helper: fetch sentence and prepare view data
  async function getSentenceViewData(id?: number) {
    const sentence = id
      ? await getSentenceById(getKnex(), id)
      : await getRandomSentence(getKnex());

    if (!sentence) return null;

    const pinyin = sentence.components
      .filter((c) => !c.punctuation && c.pinyin)
      .map((c) => c.pinyin)
      .join(" ");

    return {
      zh_sentence: sentence.zh,
      en_sentence: sentence.en,
      pinyin,
      has_audio: sentence.has_audio,
      audio_id: sentence.audio_id,
    };
  }

  fastify.get("/sentence", async (request, reply) => {
    const id = (request.query as { id?: number }).id;
    const data = await getSentenceViewData(id);

    if (!data) {
      return reply.view("partials/error.ejs", {
        message: "Server failed to get sentence",
      });
    }

    return reply.view("partials/sentence.ejs", data);
  });

  fastify.get("/random", async (request, reply) => {
    const layout = layoutForHtmx(request);
    const id = (request.query as { id?: number }).id;
    const data = await getSentenceViewData(id);

    if (!data) {
      return reply.view(
        "partials/error.ejs",
        {
          message: "Server failed to get sentence",
        },
        layout ? { layout } : {},
      );
    }

    return reply.view("random.ejs", data, layout ? { layout } : {});
  });

  const RANDOM_PROGRESS_VALUE = Math.floor(Math.random() * 100);

  fastify.get("/progress", async (request, reply) => {
    const layout = layoutForHtmx(request);
    return reply.view(
      "progress.ejs",
      {
        progressValue: RANDOM_PROGRESS_VALUE,
      },
      layout ? { layout } : {},
    );
  });

  fastify.get("/toggle-theme", async (request, reply) => {
    const current = (request.query as { current?: string }).current;
    const nextTheme = current === "dark" ? "light" : "dark";

    return reply.view("partials/theme-button.ejs", {
      theme: nextTheme,
    });
  });

  fastify.get("/audio/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const audio = await getSentenceTatoebaAudio(getKnex(), parseInt(id, 10));
    return reply.type("audio/ogg; codecs=vorbis").send(audio);
  });

  fastify.get("/privacy", async (request, reply) => {
    const layout = layoutForHtmx(request);
    return reply.view(
      "privacy.ejs",
      { title: "Privacy Policy" },
      layout ? { layout } : {},
    );
  });
};

export default routes;
