import fastify from "fastify";
import { getRandomSentence } from "./quiz.js";
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
    return reply.viewAsync(
      "index.ejs",
      { title: "Home" },
      layout ? { layout } : {}
    );
  });

  fastify.get("/new", async (request, reply) => {
    const layout = layoutForHtmx(request);
    return reply.viewAsync(
      "partials/new.ejs",
      {
        userAgent: request.headers["user-agent"],
        time: new Date().toISOString(),
      },
      layout ? { layout } : {}
    );
  });

  fastify.get("/phrase", async (_request, reply) => {
    return reply.viewAsync("partials/phrase.ejs", {
      subject: "我",
      subjectPinyin: "wǒ",
      verb1: "喜欢",
      verb1Pinyin: "xǐ huān",
      verb2: "喝",
      verb2Pinyin: "hē",
      object: "茶",
      objectPinyin: "chá",
    });
  });

  fastify.get("/random", async (_request, reply) => {
    return reply.viewAsync("partials/random.ejs", {
      number: Math.floor(Math.random() * 100),
    });
  });

  const RANDOM_PROGRESS_VALUE = Math.floor(Math.random() * 100);

  fastify.get("/progress", async (request, reply) => {
    const layout = layoutForHtmx(request);
    return reply.viewAsync(
      "partials/progress.ejs",
      {
        progressValue: RANDOM_PROGRESS_VALUE,
      },
      layout ? { layout } : {}
    );
  });

  fastify.get("/toggle-theme", async (request, reply) => {
    const current = (request.query as { current?: string }).current;
    const nextTheme = current === "dark" ? "light" : "dark";

    return reply.view("partials/theme-button.ejs", {
      theme: nextTheme,
    });
  });

  /**
   * API Routes
   */
  fastify.get("/api/quiz/sentence", async (_request, reply) => {
    const sentence = await getRandomSentence(getKnex());
    if (!sentence) {
      return reply.status(500).send({
        error: "Server failed to get random sentence",
      });
    }
    return reply.send(sentence);
  });
};

export default routes;
