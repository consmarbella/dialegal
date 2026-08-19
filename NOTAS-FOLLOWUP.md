# NOTAS-FOLLOWUP (no ejecutar - registrar para futuras iteraciones)

Fecha: 2026-08-19. Trabajo ejecutado: redirecciones 301 /p/* (653 URLs) + GEO/LLM.
Estas notas se detectaron durante la ejecución pero quedaron FUERA del alcance acordado.

## Actualizado: mejoras de indexación ejecutadas el 2026-08-19 (commit cab37d1)
- ✅ Home enlaza las 86 páginas SEO en 7 secciones temáticas (antes solo 24). Se sirve desde `dist/index.html` ESTÁTICO (Vercel sirve el estático para `/`, no Express) vía `scripts/inject-home.mjs` en el build + `src/lib/homeSsr.ts` compartido.
- ✅ Sitemap con `<lastmod>2026-08-19</lastmod>` en las 87 URLs (fuerza re-crawl de Google).
- ✅ IndexNow: clave `28ff68bc2e761ea86f7ba9b100045687.txt` servida en raíz + notificación de las 87 URLs (Bing/Yandex 202 Accepted, Seznam falló por red).
- ✅ `getRelatedPages` ampliado: 6 páginas de la misma categoría + 4 cross-categoría (hubs primero).
- ⚠️ GSC: sitemap ya procesado (0 errores). No se pudo resubmit vía API (scope GSC es readonly). El lastmod nuevo debería bastar.

## SEO / Tráfico
1. Enviar sitemap nuevo a GSC y solicitar recrawling de las URLs legadas vía URL Inspection (los 301 deben reflejarse). Las 87 URLs nuevas siguen en "Discovered - not indexed".
2. Monitorear en 2-4 semanas: las URLs /p/* deberían pasar de 404 a 301 en GSC y transferir las impresiones residuales (~1.000) a las nuevas páginas.
3. Bing: verificar BingSiteAuth.xml (ya desplegado) y resubmitir sitemap en Bing Webmaster Tools.
4. Dicom/prescripción, poderes y declaraciones juradas (~299 URLs a home) no tienen página equivalente. Considerar crear hubs por tema (notarial/poderes) en el futuro para no perder ese equity en home.

## GEO / LLM
5. Registrar legalhelp.cl en índices LLM (llms.txt index, Kagi, Perplexity) y en AI Overviews vía GSC.
6. Considerar agregar <meta name="keywords"> no; en su lugar: enriquecer FAQPage schema con las preguntas de alta intención (ya presente) y agregar "Speakable" schema.
7. Evaluar agregar bloques FAQ a las páginas con alta citación potencial (prescripción de deudas, pensión alimenticia, despido) - ya existen.
8. llms-full.txt: validar que no exceda límites de contexto de los crawlers (115KB ok) y monitorear si conviene dividirlo por tema.

## Técnico
9. Los 301 se sirven desde Express (serverless). Para URLs con query string (?p=, ?s=, etc.) Vercel ya tiene redirect global 301. Verificar que /p/* con query string redirija bien (el catch de query strings podría interferir).
10. PageSpeed/CrUX sigue bloqueado (falta api_key de Google). GA4 sin configurar.
11. Considerar indexar /p/* viejas en robots (no es necesario: 301 ya evita el 404).

## Validaciones pendientes
12. Confirmar en GSC (1-3 semanas) que no quedan URLs /p/* devolviendo 404 en el reporte de Cobertura.
13. Confirmar en GSC que las 87 páginas salen de "Discovered - not indexed" tras el interlinking desde home + lastmod + IndexNow (2-4 semanas).