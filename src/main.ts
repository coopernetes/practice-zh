import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { fastifyStatic } from "@fastify/static";
import { join } from "node:path";
import { pino } from "pino";

const __dirname = import.meta.dirname;

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
  });
  return fastify;
};

export const start = async () => {
  const fastify = await setupFastify();
  const port = process.env?.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const host = process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost";
  fastify.listen({
    port,
    host,
  });
};
