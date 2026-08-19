// Notifica las 87 URLs (home + 86 SEO) a IndexNow (Bing/Yandex/Seznam)
import { ALL_SEO_PAGES } from "../src/lib/homeSsr.ts";

const HOST = "legalhelp.cl";
const KEY = "28ff68bc2e761ea86f7ba9b100045687";
const urls = ["https://legalhelp.cl/", ...ALL_SEO_PAGES.map(p => `https://legalhelp.cl${p.slug}`)];

const payload = { host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls };

const endpoints = [
  "https://api.indexnow.org/indexnow",
  "https://www.bing.com/indexnow",
  "https://api.seznam.cz/indexnow",
  "https://yandex.com/indexnow",
];

async function main() {
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      });
      console.log(`${ep} -> ${res.status} ${res.statusText}`);
    } catch (e) {
      console.log(`${ep} -> ERROR ${e.message}`);
    }
  }
  console.log(`Notificadas ${urls.length} URLs (host=${HOST})`);
}

main();