import Fastify from "fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { fastifyStatic } from "@fastify/static";
import { fastifyView } from "@fastify/view";
import routes from "./routes.js";
import { join } from "node:path";
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

export const setupFastify = async (): Promise<FastifyInstance> => {
  let logger: object | boolean = {
    transport: {
      target: "pino-pretty",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
  if (process.env.NODE_ENV == "production") {
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
  fastify.register(knexPlugin);
  fastify.register(routes);
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
