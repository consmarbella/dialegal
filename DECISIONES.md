# DECISIONES.md — Registro de decisiones técnicas

Este archivo documenta decisiones conservadoras tomadas durante la ejecución,
siguiendo la instrucción de decidir sin preguntar. Cada fase agrega su entrada.

## Fase 0 — Seguridad del dinero (2026-10-22)

1. **Eliminado `POST /api/payment/confirm-test`** (server.ts). Grep de
   `confirm-test|confirmTest|confirm_test` en `server.ts`, `src/` y `dist/` = 0
   resultados. Era la puerta que aprobaba cualquier `orderId` sin verificar
   pago en MercadoPago.

2. **Precio fijado en el servidor.** `/api/payment/create` deconstruye solo
   `name/rut/email` del cuerpo; `amount` y `title` del cliente se ignoran.
   Constantes `PRECIO_DICTAMEN = 19990` (CLP) y `TITULO_DICTAMEN` en server.ts.

3. **Defensa de monto en dos puertas** (la instrucción pedía `/status`; se
   extendió al webhook por ser la otra vía que marca `approved`):
   - `/api/payment/status`: si el pago aprobado trae `transaction_amount`
     menor que `order.amount`, la orden se marca `failed` y no desbloquea.
   - `/api/payment/webhook`: misma verificación antes de marcar `approved`
     (calculada contra la orden existente; si la orden no está en memoria no
     aplica, quedará cubierta cuando la Fase 2 migre órdenes a la base).
   Elección conservadora: compara `<` estricto, no tolerancia por fees.
   Si MercadoPago devolviera montos con decimales en CLP, `Number()` los
   trunca a flotantes y la comparación sigue siendo válida para montos
   enteros.

4. **Rate limit por IP (30/hora) en `/api/analyze`, `/api/chat` y
   `/api/legalhelp/draft`** reutilizando `src/lib/rateLimit.ts`. Valor
   configurable vía `GENERAL_API_RATE_LIMIT_MAX` (default 30, ventana 3.600s).
   Limitación conocida y documentada en el código: el `Map` en memoria es por
   instancia serverless y se pierde en cada cold start; el límite es defensivo
   y se migrará a la base de datos en la Fase 2. `/api/generate-document`
   mantuvo su límite previo (10/min) sin cambios.

5. **`.env.example` con placeholders.** Contenía un `MP_ACCESS_TOKEN` con
   forma de token real (`APP_USR-...-...`), que quedó en el historial de git
   de commits anteriores. Se reemplazó por placeholders y se agregaron las
   variables nuevas (`GENERAL_API_RATE_LIMIT_MAX`, `CORPUS_COMPLETO`,
   `DATABASE_URL` comentado). **No se reescribió el historial de git** (riesgo
   y orden prohibidos por la tarea). Contramedida: la rotación del token la
   hace el dueño en el panel de MercadoPago (acción ya pendiente, ver
   INFORME.md). Ese token debe considerarse comprometido desde que fue
   commiteado.

6. **Bandera grounding sin cambios de comportamiento.** `server.ts` usa
   `PREMIUM_GROUNDING_ENABLED` (definida en `true` en Vercel ⇒
   `/api/premium-report` está ACTIVO en producción; el comentario antiguo
   "Prod (Vercel) no define PREMIUM_GROUNDING_ENABLED" está obsoleto y se
   corrige en la Fase 1). `legalhelp-draft.ts` usa `PREMIUM_GROUNDING`
   (no definida en Vercel ⇒ los borradores corren sin búsqueda web y sin
   exigir grounding: comportamiento actual, se conserva para no aumentar
   latencia/costo/cuota por accidente). Las dos variables son distintas por
   diseño: una es gate del endpoint premium, la otra exige grounding en
   borradores. Documentado en comentarios del código.

7. **Ambigüedad: nombre del título del ítem MCP.** Se escogió
   `${TITULO_DICTAMEN} - LegalHelp Chile` (idéntico al comportamiento previo).

## Fase 1 — Cinco bugs del motor (2026-10-22)

1. **`SYSTEM_PROMPT_LEGALHELP` ahora se envía.** Ambas llamadas de
   `src/server/legalhelp-draft.ts` incluyen
   `config.systemInstruction = SYSTEM_PROMPT_LEGALHELP` (con
   `temperature: 0.1` y `maxOutputTokens: 8192`, que antes construía la copia
   local del fallback y se perdían al consolidar).

2. **`generateWithFallback` consolidado en `src/server/llmEngine.ts`.** Se
   movió allí la versión completa (cadena dinámica con auto-listado cacheado,
   pausa por cuota diaria por modelo+key, reintentos con backoff, exigencia de
   grounding con fallback degradado, errores tipados
   `GeminiQuotaExhaustedError`/`GeminiUnavailableError`). `server.ts` importa
   de este módulo; `legalhelp-draft.ts` también. La lógica de
   `/api/premium-report` no cambia (misma implementación, otro archivo).
   Los errores tipados siguen funcionando vía `sendQuotaExhausted`.

3. **Errores ya no se tragan en silencio.** La copia simple del módulo de
   borradores (que filtraba 429/404 y se comía el resto sin log) desapareció
   con la consolidación; además el fallback "con grounding → sin grounding"
   del borrador imprime `console.warn` con el motivo truncado a 300 chars.

4. **Bandera de grounding sin cambio de comportamiento.** El comentario
   obsoleto "Prod (Vercel) no define PREMIUM_GROUNDING_ENABLED" se corrigió
   (verificado: la variable está en `true` en Vercel Production ⇒
   `/api/premium-report` activo). `legalhelp-draft.ts` sigue leyendo
   `PREMIUM_GROUNDING` (no definida ⇒ borradores sin búsqueda web); NO se
   renombró ni fusionó nada para no encender grounding en borradores por
   accidente. Documentado en comentarios de ambos archivos y arriba (F0.6).

5. **Contador de roles corregido en ambos validadores**
   (`validadorInforme.ts` y `validadorLegalHelp.ts`, mismo patrón duplicado):
   `rolesNoEnCorpus = rolesInforme.filter(r => !rolesEnCorpus.includes(r))`,
   complemento exacto de `rolesEnCorpus`. Piloto
   `scripts/validador-pilot.ts`: rol ficticio solo en "fuera del corpus";
   regresión nueva `scripts/regression-roles.ts` (roles con formato
   `28.321-2021` vs `28321-2021`) cuenta cada rol UNA vez.

QA: `tsc --noEmit` OK; pilotos verde; prueba de punta a punta local
(`scripts/qa-draft-fase1.ts`): borrador otrosí generado en 16 s por
`gemini-3.6-flash` con `systemInstruction` activo y cadena 10/10 disponible.

## Fase 2 — Órdenes en Postgres/Neon (2026-10-22)

1. **`src/lib/orderStore.ts` reescrito con persistencia en Postgres**
   (lib `pg`). Tabla `orders` (`order_id` PK, `preference_id` con índice
   único, `status`, `amount`, `title`, `payer_email`, `mp_payment_id`,
   `paid_at`, `created_at`, `usos`), esquema creado automático en el primer
   acceso (`CREATE TABLE IF NOT EXISTS`). Las funciones pasaron a async
   (`saveOrder`, `getOrderByOrderId`, `getOrderByPreferenceId`,
   `updateOrder`); los 10 puntos de llamada en server.ts ahora usan `await`.
   Se añade `consumeUseAtomic`: `UPDATE orders SET usos = usos + 1 WHERE
   order_id = $1 AND status = 'approved' AND usos < 3 RETURNING usos`
   (verbo del spec, verbatim).
2. **Fallback a memoria si no hay `DATABASE_URL` o la DB falla**:
   `console.warn`/`console.error` UNA sola vez por proceso (evita spam de
   logs), comportamiento idéntico al anterior. Con DB funcionando también se
   mantiene un espejo en memoria que sirve de ultratumba si la DB cae
   después de guardar.
3. **QA contra Postgres real** (contenedor docker de prueba, scripts
   `qa-orderstore-db.ts` y `qa-orderstore-mem.ts`):
   save+get, update, índice por `preference_id`, contador atómico (4
   consumos → solo 3 `ok`), re-save no pisa `usos` ni `paid_at`, y modo
   memoria (warn único, flujo completo).
4. `PORT` local ahora configurable (`process.env.PORT`), el 3000 chocaba con
   un servidor de Docker en esta máquina. Vercel no se ve afectado.

## Fase 3 — Paywall server-side de /api/premium-report (2026-10-22)

1. **`orderId` obligatorio en el body de `/api/premium-report`**; sin él →
   400. Orden no aprobada o sin usos → 402 con
   `usosRestantes`. `requirePaidOrder` lee la orden de la DB; si falta o
   está pendiente consulta MP por `external_reference` y "cura" la orden
   (guardándola aprobada, con defensa de monto `transaction_amount >= 19990`).
2. **3 usos por orden con conteo atómico en DB.** El uso se descuenta SOLO
   después de tener el dictamen listo (generación OK o hit de caché); el
   acierto de caché TAMBIÉN consume un uso. Si el contador rechaza (usos
   agotados), el informe listo NO se entrega (402). `usosRestantes` sale en
   la respuesta.
3. **Degradación temporal, documentada:** sin `DATABASE_URL` la verificación
   MP sigue operando, pero no es posible contar usos (`consumeUseSeguro`
   avisa por console.warn y deja pasar). Regresará en cuanto el dueño cree
   Vercel Postgres/Neon y defina `DATABASE_URL` (accione pendiente del dueño,
   esquema auto-creado en el primer arranque).
4. **Frontend:** `App.tsx` guarda el `orderId` (URL de retorno y
   localStorage `pjud_legal_last_orderId`) y lo manda a
   `/api/premium-report`. El desbloqueo por código admin o botón simulado
   (solo local) NO tiene `orderId` por lo cual esos flujos desbloquean el
   dictamen normal, no la capa premium (así estaba pensado: la capa premium
   se exige con pago real en DB/MP).
5. **QA e2e local con Postgres** (script `qa-paywall-fase3.ts`, server real
   en :3210 apuntando `DATABASE_URL` al contenedor): sin orderId → 400;
   orden pendiente → 402; orden aprobada → 200 con `usosRestantes=2`
   (generación premium real, 49 s, 16.469 chars de dictamen); cache-hit
   consume 2.º uso; 3.º uso OK (`usosRestantes=0`); 4.º uso → 402. Estado
   final en DB: `usos=3, status='approved'`.

Nota de proceso: Fases 2 y 3 salen en un único commit+deploy (F3 depende del
esquema y funciones de F2; mantener dos deploys separados habría dejado la
versión intermedia con `/api/premium-report` 402 pero orden sin persistir).

## Post-auditoria Fases 0-3 - correcciones (2026-10-23)

Auditoria de verificacion (compilados vs decisiones, DB y prod) encontro 4 defectos reales corregidos:
1. **saveOrder pisa datos MP en re-save (F3 heal).** Duplicado: heal re-guarda la orden
   aprobada sin mp_payment_id/paid_at y el ON CONFLICT escribia lo nuevo NULL encima.
   Corregido: `COALESCE(EXCLUDED.x, orders.x)` y la columna `mp_payment_id` ahora SI se
   inserta (no estaba en la lista de columnas del INSERT). QA: `qa-orderstore-db.ts`
   hecho idempotente (limpia sus filas al inicio) con 8/8 PASS, incluidos heal y preservacion.
2. **Uso explotaba si la DB caia tras generar el dictamen.** `consumeUseAtomic` lanzaba y
   el response era 500 aun con dictamen listo. Corregido: `consumeUseSeguro` degrada
   (console.error) y entrega el dictamen sin descuento; el QA e2e confirma el flujo.
3. **Doble cobro en cache corrupta.** El hit de cache JSON-invalido consumia un uso y
   luego re-generaba: cobraba 2 usos por 1 dictamen. Corregido: parse del cache ANTES de
   consumir; si el JSON es corrupto se regenera sin descontar. Complemento Fase 4
   conexo: el resolver ya guarda la entrada resuelta en `normaCache` (seeding por
   idNorma), por lo que el re-archivo del pendiente ya no re-descarga el XML.
4. **Rate limit ausente en /api/premium-report.** Se aplica `checkRateLimit("premium:<ip>", 5/min)`
   (PAYMENT_RATE_LIMIT ya importado en Fase 0); override por env `PREMIUM_RATE_LIMIT_MAX`
   para QA local. El 400 por falta de orderId ocurre ANTES del limite (no consume cupo).

Verificado ademas: prod (legalhelp.cl) 200/400/402 correctos con orden fake 404;
`npx tsc --noEmit` limpio; deploy mantendra las dos capas en un solo deploy (ver abajo).

## Fase 4 - Resolución genérica de leyes + cruce artículo<->norma (2026-10-23)

1. **Resolución de CUALQUIER "Ley N° X.XXX".** Canal documentado
   `obtxml?opt=7&idLey=<numero>` (probe 2026-10-22: idLey=18290 -> XML con
   `<Tipo>Ley</Tipo><Numero>18290</Numero>`, normaId="29708"). El resolver verifica
   Tipo=Numero exacto (DL/DFL no usan idLey y quedan pendientes
   `norma_no_resoluble`). Fallos en cache 30 min; aciertos persistidos en tabla
   `leyes` (Postgres, `CREATE TABLE IF NOT EXISTS`) con ON CONFLICT ley_num.
2. **Cruce determinista artículo<->norma** (`extraerCitadasPorNorma`): regex, sin red,
   ventana "ley después" <= 120 chars y "ley antes" <= 400, tope 12 arts/norma y
   techo MAX_GENERICOS=8 leyes genericas por llamada. Datos de QA: "Art. 1 de la
   Ley 21.430" + "Art. 157 de la Ley 18.290" -> 1->LEY21430 y 157->L18290
   correctos; heurística de ventana igual a la del código antiguo, se degrada a
   advisory de calidad de cita, no bloquea ni penaliza el texto.
3. **Cobertura estricta en validarLegalHelp.** insumos `artsCubiertos` ahora son
   claves `KEY:art` (p.ej. `L18290:157`, generico `LEY21430:1`); un "Art. N"
   SOLO cuenta cubierto si el cruce asigna la cita a la MISMA norma verificada
   por el servidor. Cita sin ley asociable -> degrada a cobertura por número +
   advisory `articulosSinNorma` en la nota de blindaje (no falsa "sin cobertura"
   por formato de cita). Retro-compatible: claves sin `:` usan el camino antiguo.
   `validadorInforme.ts` (canal premium) queda INTACTO; su versión estricta
   llega con Fase 5.
4. **QA:**

   - `qa-leyes-fase4.ts` (BCN en vivo): Ley 21.430 resuelta por idLey y Ley 18.290

     Art. 157 verificada; 290ms con cache; filas `leyes(21430->1173643)` en DB

     y `leyes(20123->254080)` (probada en mock de pruebas anteriores).

   - `qa-validador-fase4.ts` (determinista, sin red): 7/7 PASS (cobertura

     correcta, misma cifra en OTRA norma -> sin cobertura, sin ley asociable ->

     advisory, retro-compatib., multi-norma en texto, nota de blindaje).


## Fase 5 - Corpus completo por area (2026-10-23)

1. **Fuente:** dataset Open Legal Chile `pablobenavidesj/doctrina-jurisprudencia-chile-training`
   (instituciones.jsonl, 11.858 fichas dogmaticas con institucion/materia/definicion/
   operativa_procesal/concordancias/fallo_rector/contenido). El generador
   `scripts/corpus_ingest_full.py` reusa EXACTAMENTE las mismas heuristicas de
   calidad y el dedup por institucion del ingest laboral original
   (juris_ingest_laboral.py); tras filtros quedan 2.130 institucionos unicas
   repartidas en 7 archivos `data/corpus-full/<slug>.json`:
   laboral 169 · civil 260 · familia 245 · penal 402 · administrativo 40 ·
   constitucional 147 · transversal 867 (Judicial+Procesal+General).
   `contenido` se recorta a 2500 chars/ficha (el peso de contenido en el scorer
   es C_W=1, el mas bajo) para que el paquete total sea ~6.5 MB.
2. **Gate por env `CORPUS_COMPLETO=true`:** `getIndiceExtendido(slug)` carga SOLO
   el archivo del area pedida + `transversal`, con cache por proceso (corpus
   parseado e indice tokenizado una vez por area; busquedas posteriores ~0ms).
   Con el gate apagado el camino es identico al anterior (misma respuesta,
   costo 0): `qa-corpus-fase5.ts` verifica ambas modalidades - determinista,
   13/13 PASS, primera busqueda por area ~350-420 ms (construccion en caliente).
3. **Conecta en:** borrador (handler /api/legalhelp-draft -> slug = input.area) y
   dictamen premium (server.ts -> slug = area declarada por la UI o el area
   detectada con detectAreaFromContext del texto). Los casos (busqueda por rol)
   siguen usando el corpus de fallos CS sin cambios.
4. **e2e con generacion real:** demanda de familia con corpus completo -> draft
   13.997 chars, estructura y validacion OK en 6/6 (Gemini degradada por
   tormenta 503 ese mometo: la cadena de fallback actuo como es de esperar).
   Las llamadas deterministas y los probes del corpus laboral (qa-draft-fase1)
   cubren el resto del motor.
5. **Prod:** activado via env `CORPUS_COMPLETO=true` en Vercel (sin coste si el
   corpus no esta alcanzable: el loader degrada a base + aviso en consola).
   El corpus completo va COMMITTEADO (data/corpus-full/, ~6.5 MB) para que
   cualquier deploy lo regenere sin descargar HF.
