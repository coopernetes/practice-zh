import fastify from "fastify";

const layoutForHtmx = (request: fastify.FastifyRequest) => {
  const isHtmx = !!request.headers["hx-request"];
  return isHtmx ? undefined : "layout.ejs";
};

export const routes = async (fastify: fastify.FastifyInstance) => {
  fastify.get("/", async (request, reply) => {
    const layout = layoutForHtmx(request);
    return reply.view("index.ejs", { title: "Home" }, layout ? { layout } : {});
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

  fastify.get("/toggle-theme", async (request, reply) => {
    const current = (request.query as { current?: string }).current;
    const nextTheme = current === "dark" ? "light" : "dark";

    return reply.view("partials/theme-button.ejs", {
      theme: nextTheme,
    });
  });
};

export default routes;
