import MarkdownIt from "markdown-it";
import { v4 } from "uuid";

interface Item {
  id: string;
  src: string;
  html: string;
}

const db: Array<Item> = [];

interface EndpointHandler {
  (req: any, res: any): void | Promise<void>;
}

interface EndpointDefiner {
  (path: string, handler: EndpointHandler, options?: any): void;
}

interface Router {
  get: EndpointDefiner;
  put: EndpointDefiner;
  post: EndpointDefiner;
  delete: EndpointDefiner;
  patch: EndpointDefiner;
  all: EndpointDefiner;
}

export function setup(router: Router) {
  const md = MarkdownIt();

  router.get("/", (_, reply) => {
    reply.send({
      items: db.map((item) => item.id),
    });
  });

  router.get("/:id", (request, reply) => {
    const { id } = request.params;
    const { accept = "" } = request.headers;
    const acceptTypes = accept.split(",");
    const item = db.find((m) => m.id === id);

    if (!item) {
      return reply.callNotFound();
    }

    if (acceptTypes.includes("text/html")) {
      return reply.header("content-type", "text/html").send(item.html);
    }

    return reply.send(item);
  });

  router.delete("/:id", (request, reply) => {
    const { id } = request.params;
    const index = db.findIndex((m) => m.id === id);

    if (index === -1) {
      return reply.callNotFound();
    }

    db.splice(index, 1);
    return reply.status(204).send();
  });

  router.post("/", async (req, reply) => {
    const id = v4();
    const { src } = req.body;

    if (!src || typeof src !== "string") {
      return reply.status(400).send({
        message: 'Expected the "src" field to be a non-empty string.',
      });
    }

    const html = md.render(src);
    db.push({
      id,
      src,
      html,
    });
    reply.send({ id });
  });
}
