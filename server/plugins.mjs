import Router from "find-my-way";
import { SourceTextModule, SyntheticModule, createContext } from "vm";
import { WebSocket } from "ws";

const feed = "https://feed.dev.piral.cloud/api/v1/pilet/fastify-demo";
const changeEventTypes = ["add-pilet", "update-pilet", "remove-pilet"];
const current = [];
const routers = {};

async function linkNodeModule(specifier, context) {
  const content = await import(specifier);
  const exports = Object.keys(content);
  return new SyntheticModule(
    exports,
    function () {
      for (const name of exports) {
        this.setExport(name, content[name]);
      }
    },
    {
      context,
    }
  );
}

async function linkModule(url, context) {
  const res = await fetch(url);
  const content = await res.text();
  const mod = new SourceTextModule(content, {
    context,
  });
  await mod.link((specifier) => {
    if (specifier.startsWith("node:")) {
      return linkNodeModule(specifier, context);
    }

    const newUrl = new URL(specifier, url);
    return linkModule(newUrl.href, context);
  });
  await mod.evaluate();
  return mod;
}

async function loadModule(url) {
  const context = createContext();

  try {
    const res = await linkModule(url, context);
    return res.namespace;
  } catch (ex) {
    console.warn(`Failed to evaluate "${url}":`, ex);
    return {};
  }
}

function makeId(item) {
  return `${item.name}@${item.version}`;
}

function buildPath(prefix, namespace, path) {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  return `${prefix}/${namespace}${path}`;
}

function buildHandler(handler) {
  return (req, reply, params) => {
    const headers = req.headers;
    const request = { ...req, headers, params };
    return handler(request, reply);
  };
}

async function installPlugin(item, prefix) {
  const { name, link } = item;
  const { setup } = await loadModule(link);
  const router = Router();
  typeof setup === "function" &&
    setup({
      get(path, handler, options = {}) {
        router.get(buildPath(prefix, name, path), options, buildHandler(handler));
      },
      put(path, handler, options = {}) {
        router.put(buildPath(prefix, name, path), options, buildHandler(handler));
      },
      post(path, handler, options = {}) {
        router.post(buildPath(prefix, name, path), options, buildHandler(handler));
      },
      delete(path, handler, options = {}) {
        router.delete(buildPath(prefix, name, path), options, buildHandler(handler));
      },
      patch(path, handler, options = {}) {
        router.patch(buildPath(prefix, name, path), options, buildHandler(handler));
      },
      all(path, handler, options = {}) {
        router.all(buildPath(prefix, name, path), options, buildHandler(handler));
      },
    });
  routers[name] = router;
  current.push({ id: makeId(item), name });
}

async function uninstallPlugin(item) {
  delete routers[item.name];
  current.splice(current.indexOf(item), 1);
}

function watchPlugins(prefix) {
  console.log("Watching plugins ...");
  const ws = new WebSocket(feed.replace("http", "ws"));

  ws.on("error", console.error);

  ws.on("message", async (data) => {
    const msg = JSON.parse(Buffer.from(data).toString("utf8"));

    if (changeEventTypes.includes(msg.type)) {
      const res = await fetch(feed);
      const { items } = await res.json();
      const removeItems = current.filter(
        ({ id }) => !items.some((n) => makeId(n) === id)
      );
      const addItems = items.filter(
        (item) => !current.some(({ id }) => id === makeId(item))
      );

      for (const item of removeItems) {
        await uninstallPlugin(item);
      }

      for (const item of addItems) {
        await installPlugin(item, prefix);
      }
    }
  });
}

export async function loadPlugins({ prefix }) {
  console.log("Loading plugins ...");
  const res = await fetch(feed);
  const { items } = await res.json();

  for (const item of items) {
    const id = makeId(item);
    console.log(`Integrating plugin "${id}" ...`);
    await installPlugin(item, prefix);
    console.log(`Integrated plugin "${id}"!`);
  }

  watchPlugins(prefix);
}

export async function handleFromPlugin(request, reply) {
  const { namespace } = request.params;
  const router = routers[namespace];

  if (router) {
    return router.lookup(request, reply);
  }

  return reply.callNotFound();
}
