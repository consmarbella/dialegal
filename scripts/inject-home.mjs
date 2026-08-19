import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { renderHomeContent } from "../src/lib/homeSsr.ts";

const indexPath = join(process.cwd(), "dist", "index.html");
let html = readFileSync(indexPath, "utf-8");
const baseUrl = process.env.APP_URL?.replace(/\/$/, "") || "https://legalhelp.cl";
const content = renderHomeContent(baseUrl);
const injected = html.replace('<div id="root"></div>', `<div id="root">${content}</div>`);
if (injected === html) {
  console.error("WARN: no se encontro <div id=\"root\"></div> en dist/index.html; no se inyecto el contenido SSR");
} else {
  writeFileSync(indexPath, injected);
  const links = (injected.match(/href="https:\/\/legalhelp\.cl\/[^"]+"/g) || []).length;
  console.log(`SSR inyectado en dist/index.html: ${links} links internos`);
}