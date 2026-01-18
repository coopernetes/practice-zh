import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { fastifyStatic } from "@fastify/static";
import { fastifyView } from "@fastify/view";
import { fastifyCookie } from "@fastify/cookie";
import { fastifySession } from "@fastify/session";
import { fastifyFormbody } from "@fastify/formbody";

import { apiRoutes } from "./routes/api.js";
import { uiRoutes } from "./routes/ui.js";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { pino } from "pino";
import { knexPlugin, setKnex } from "./db.js";
import knex from "knex";
import knexConfig from "../knexfile.js";

const __dirname = import.meta.dirname;

declare module "fastify" {
  interface FastifyReply {
    render(viewPath: string, data?: object): void;
  }
}

declare module "@fastify/session" {
  interface FastifySessionObject {
    userId?: any;
  }
}

export const setupFastify = async (): Promise<FastifyInstance> => {
  let logger: object | boolean = {
    transport: {
      target: "pino-pretty",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
  if (process.env.NODE_ENV === "production") {
    logger = true;
  }
  const fastify = Fastify({
    logger,
  });
  fastify.register(fastifyStatic, {
    root: join(__dirname, "..", "public"),
    prefix: "/public/",
  });
  fastify.register(fastifyView, {
    engine: {
      ejs: await import("ejs"),
    },
    root: join(__dirname, "..", "views"),
  });
  fastify.register(fastifyFormbody);
  fastify.register(fastifyCookie);
  fastify.register(fastifySession, {
    cookieName: "sessionId",
    secret:
      process.env.SESSION_SECRET ||
      Buffer.from(randomBytes(16)).toString("hex"),
    cookie: {
      maxAge: 1209600000, // 14 days
      secure: process.env.NODE_ENV === "production",
    },
  });
  fastify.register(knexPlugin);
  fastify.register(apiRoutes);
  fastify.register(uiRoutes);
  return fastify;
};

export const start = async () => {
  const env =
    process.env.NODE_ENV === "production" ? "production" : "development";

  const cfg = knexConfig[env];
  if (!cfg) {
    throw new Error(`No knex config for environment: ${env}`);
  }
  setKnex(knex(cfg));

  const fastify = await setupFastify();
  const port = process.env?.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const host = process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost";
  fastify.listen({
    port,
    host,
  });
};
