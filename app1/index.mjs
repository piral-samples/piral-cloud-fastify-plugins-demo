export function setup(router) {
  router.get("/foo", (request, reply) => {
    reply.send("Hello from app1 v2: /foo");
  });
}
