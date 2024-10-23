import Fastify from "fastify";
import { loadPlugins, handleFromPlugin } from "./plugins.mjs";

const fastify = Fastify({
  logger: true,
});

const port = 3000;
const prefix = '/api';

await loadPlugins({ prefix });

fastify.get("/", (_, reply) => {
  return reply.send({ hello: "world" });
});

fastify.all(`${prefix}/:namespace/*`, (request, reply) => {
  return handleFromPlugin(request, reply);
});

fastify.listen({ port });
