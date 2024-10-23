import { compute } from './other.mjs';

export function setup(router) {
  router.get("/compute", (req, reply) => {
    const { a, b } = req.query;
    const c = compute(+a, +b);

    if (!isNaN(c)) {
      return reply.status(200).send(`${c}`);
    }

    return reply.status(400).send(`Only numbers allowed.`);
  });
}
