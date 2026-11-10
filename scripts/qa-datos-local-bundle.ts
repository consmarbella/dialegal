// Prueba el bundle de produccion EXACTAMENTE como Vercel lo carga (api/index.ts):
// createRequire sobre dist/server.cjs, con VERCEL=1 y NODE_ENV=production para
// forzar la rama serverless del arranque.
import { createRequire } from "node:module";
import http from "node:http";

const require = createRequire(import.meta.url);
const serverModule = require("../dist/server.cjs");
const app = serverModule.handler ?? serverModule.default ?? serverModule;

const server = http.createServer(app);
await new Promise<void>((r) => server.listen(4519, "127.0.0.1", r));

const rutas = ["/", "/datos", "/datos/", "/herramientas", "/sitemap.xml"];
for (const ruta of rutas) {
  const res = await fetch(`http://127.0.0.1:4519${ruta}`, { redirect: "manual" });
  const head = await res.text();
  console.log(`${res.status} ${ruta} len=${head.length} ${head.slice(0, 60).replace(/\s+/g, " ")}`);
}
server.close();
process.exit(0);
