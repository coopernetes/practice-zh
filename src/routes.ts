import fastify from "fastify";

export const routes = async (fastify: fastify.FastifyInstance) => {
  fastify.get("/", (req, res) => {
    res.sendFile("index.html");
  });
  fastify.get("/new", async (req, res) => {
    return res.viewAsync("new.html.ejs", {
      userAgent: req.headers["user-agent"],
      time: new Date().toISOString(),
    });
  });
};

export default routes;
