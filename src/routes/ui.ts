import fastify from "fastify";
import { getRandomSentence, getSentenceById } from "../corpus.js";
import { getKnex } from "../db.js";
import { verifyPassword } from "../utils.js";

const layoutForHtmx = (request: fastify.FastifyRequest) => {
  const isHtmx = !!request.headers["hx-request"];
  return isHtmx ? undefined : "layout.ejs";
};

export const uiRoutes = async (fastify: fastify.FastifyInstance) => {
  fastify.get("/", async (request, reply) => {
    const layout = layoutForHtmx(request);
    return reply.view(
      "pages/index.ejs",
      { title: "Home" },
      layout ? { layout } : {},
    );
  });

  fastify.get("/login", async (request, reply) => {
    const layout = layoutForHtmx(request);
    return reply.view(
      "login.ejs",
      { title: "Login", error: undefined },
      layout ? { layout } : {},
    );
  });

  fastify.post("/login", async (request, reply) => {
    const layout = layoutForHtmx(request);
    const { email, password } = request.body as {
      email: string;
      password: string;
    };
    const knex = getKnex();
    const user = await knex("users")
      .select("password_hash", "salt", "id")
      .where("email", email)
      .first();
    if (user) {
      const { password_hash, salt } = user;
      if (verifyPassword(password, salt, password_hash)) {
        // Set session userId
        if (request.session) {
          request.session.userId = user.id;
        }
        return reply.redirect("/quiz");
      } else {
        console.log(`Invalid password attempt for email: ${email}`);
      }
    } else {
      console.log(`Login attempt with unknown email: ${email}`);
    }
    return reply.view(
      "login.ejs",
      { error: "Invalid email or password" },
      layout ? { layout } : {},
    );
  });

  fastify.post("/logout", async (request, reply) => {
    const layout = layoutForHtmx(request);
    if (request.session) {
      request.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
        }
      });
    }
    return reply.view("partials/logout-message.ejs", layout ? { layout } : {});
  });

  fastify.get("/quiz", async (request, reply) => {
    const layout = layoutForHtmx(request);
    return reply.view(
      "pages/quiz.ejs",
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
      id: sentence.id,
      zh_sentence: sentence.zh,
      en_sentence: sentence.en,
      pinyin,
      has_audio: sentence.has_audio,
      audio_id: sentence.audio_id,
    };
  }

  fastify.get("/sentence", async (request, reply) => {
    const query = request.query as { id?: string };
    const id = query.id ? parseInt(query.id, 10) : undefined;
    console.log("Fetching sentence with id:", id);
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
    const query = request.query as { id?: string };
    const id = query.id ? parseInt(query.id, 10) : undefined;
    console.log("Random route - raw query:", request.query);
    console.log("Random route - parsed id:", id);
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

    return reply.view("pages/random.ejs", data, layout ? { layout } : {});
  });

  const RANDOM_PROGRESS_VALUE = Math.floor(Math.random() * 100);

  fastify.get("/progress", async (request, reply) => {
    const layout = layoutForHtmx(request);
    return reply.view(
      "pages/progress.ejs",
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

  fastify.get("/privacy", async (request, reply) => {
    const layout = layoutForHtmx(request);
    return reply.view(
      "pages/privacy.ejs",
      { title: "Privacy Policy" },
      layout ? { layout } : {},
    );
  });
};
