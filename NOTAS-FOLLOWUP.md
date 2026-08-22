# NOTAS-FOLLOWUP (no ejecutar - registrar para futuras iteraciones)

Fecha: 2026-08-19 (última actualización: 2026-08-22).
Trabajo ejecutado: redirecciones 301 /p/* (653 URLs) + GEO/LLM + fixes técnicos.
Estas notas se detectaron durante la ejecución pero quedaron FUERA del alcance acordado.

## Completado el 2026-08-22 (commits 797419e)
- ✅ Trailing slash: `vercel.json` con `trailingSlash:false` redirige `/page/` → `/page` (308).
- ✅ X-Powered-By: `app.disable("x-powered-by")` en server.ts.
- ✅ Custom 404: página 404 HTML con CTA "Volver al inicio" + `noindex` (reemplaza SPA fallback).
- ✅ og:image: imagen 1200x630 generada con Pillow en `public/og-image.png` (30KB). Agregada a home + 86 páginas SEO (og:image + twitter:image).
- ✅ Meta description homepage: recortada de 192 a 120 chars.
- ✅ Inspección GSC batch: 87 URLs inspeccionadas vía API. Home PASS (indexed). ~52 URLs "Discovered". ~10 pasaron de "unknown" a "Discovered" tras inspección.
- ✅ Scripts: `batch_inspect.py`, `gen_og_image.py`, `gen_batch_urls.py`.

## Actualizado: mejoras de indexación ejecutadas el 2026-08-19 (commit cab37d1)
- ✅ Home enlaza las 86 páginas SEO en 7 secciones temáticas (antes solo 24). Se sirve desde `dist/index.html` ESTÁTICO (Vercel sirve el estático para `/`, no Express) vía `scripts/inject-home.mjs` en el build + `src/lib/homeSsr.ts` compartido.
- ✅ Sitemap con `<lastmod>2026-08-19</lastmod>` en las 87 URLs (fuerza re-crawl de Google).
- ✅ IndexNow: clave `28ff68bc2e761ea86f7ba9b100045687.txt` servida en raíz + notificación de las 87 URLs (Bing/Yandex 202 Accepted, Seznam falló por red).
- ✅ `getRelatedPages` ampliado: 6 páginas de la misma categoría + 4 cross-categoría (hubs primero).
- ⚠️ GSC: sitemap ya procesado (0 errores). No se pudo resubmit vía API (scope GSC es readonly). El lastmod nuevo debería bastar.

## SEO / Tráfico
1. **Inspección GSC completada**: 87 URLs inspeccionadas. Hallazgo: la inspección vía API SÍ hace efecto — Google pasó de "unknown" a "Discovered" en 9 de 10 URLs problemáticas. Solo `como-anular-un-contrato` sigue como "unknown".
2. Las 86 páginas siguen en "Discovered - currently not indexed" con `last_crawl_time: null`. Google no las ha crawleado. La inspección las marca pero no fuerza crawl.
3. **Para forzar crawl real**: necesitaríamos (a) Google Indexing API con schema JobPosting/VideoObject (no aplica), o (b) que Googlebot las descubra vía links internos (ya tenemos 86 links en home) + sitemap. El tiempo de espera razonable es 2-4 semanas.
4. Bing: verificar BingSiteAuth.xml (ya desplegado) y resubmitir sitemap en Bing Webmaster Tools.
5. Dicom/prescripción, poderes y declaraciones juradas (~299 URLs a home) no tienen página equivalente. Considerar crear hubs por tema (notarial/poderes) en el futuro.

## GEO / LLM
5. Registrar legalhelp.cl en índices LLM (llms.txt index, Kagi, Perplexity) y en AI Overviews vía GSC.
6. Considerar agregar <meta name="keywords"> no; en su lugar: enriquecer FAQPage schema con las preguntas de alta intención (ya presente) y agregar "Speakable" schema.
7. Evaluar agregar bloques FAQ a las páginas con alta citación potencial (prescripción de deudas, pensión alimenticia, despido) - ya existen.
8. llms-full.txt: validar que no exceda límites de contexto de los crawlers (115KB ok) y monitorear si conviene dividirlo por tema.

## Técnico
9. Los 301 se sirven desde Express (serverless). Para URLs con query string (?p=, ?s=, etc.) Vercel ya tiene redirect global 301. Verificar que /p/* con query string redirija bien (el catch de query strings podría interferir).
10. PageSpeed/CrUX sigue bloqueado (falta api_key de Google). GA4 sin configurar.
11. **404 personalizado implementado**:不再 sirve index.html para rutas inexistentes (antes Google veía 200 para todo).
12. **Trailing slash normalizado**: Vercel `trailingSlash:false` redirige `/page/` → `/page` (308). Google entiende 308 correctamente.
13. **X-Powered-By eliminado**: header de seguridad removido.
14. **og:image agregada**: imagen 1200x630 en `public/og-image.png`. Se sirve para home y las 86 páginas SEO. Para páginas individuales con imagen custom, crear `/public/og-{slug}.png` y actualizar renderSEOPage.

## Validaciones pendientes
12. Confirmar en GSC (1-3 semanas) que no quedan URLs /p/* devolviendo 404 en el reporte de Cobertura.
13. Confirmar en GSC que las 87 páginas salen de "Discovered - not indexed" tras el interlinking desde home + lastmod + IndexNow (2-4 semanas).