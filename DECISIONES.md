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

## DATABASE_URL en produccion - integracion Supabase (2026-10-23)

1. El dueño instaló la integración de Supabase en Vercel (Marketplace). Las
   variables que crea (POSTGRES_URL/POSTGRES_HOST/etc) son gestionadas por la
   integración: NO son leibles con `vercel env pull` (valores vacíos), pero SÍ
   se inyectan en el runtime del serverless.
2. Solución sin manejar secretos por CLI: `orderStore.dbUrl()`, el índice de
   leyes (bcnLeyChile) y `consumeUseSeguro` resuelven
   `DATABASE_URL || POSTGRES_URL`.
3. TLS: Supabase usa una CA propia que Node no trae -> los Pool de pg crean ssl
   `{ rejectUnauthorized: false }` cuando el string trae `sslmode=` (pg 8.x
   trata require como verify-full y rechazaba la cadena
   "self-signed certificate in certificate chain"). Documentado, querystring
   contempla el caso.
4. Verificación e2e en prod: POST /api/payment/create (orden real MP) ->
   GET /api/payment/status -> 200 {status pending} sin el warn
   "[orderStore] No se pudo guardar en DB" que sí apareció en el deploy previo
   -> persistencia cruzada de lambda confirmada; /api/premium-report con esa
   orden (pendiente) -> 402, con orden inexistente -> 402 (solo approved
   desbloquea).
5. Restan: rotar MP_ACCESS_TOKEN; QA determinista de orderStore contra Supabase
   requiere la URL fuera de Vercel (opcional; el e2e de prod ya la cubre).

## Fase 5.1 - Corpus FULL y fix de despliegue (2026-10-28)

- **Causa raiz detectada en prod**: el packer de serverless de Vercel solo incluye
  los archivos que traza por `require`. Los JSON de `data/` se leen con
  `fs.readFileSync` de ruta dinamica (`rutaCorpus`/`getCorpusArea`) -> excluidos
  del lambda. Desde la Fase 1 el corpus NO salia en legalhelp.cl (los
  /api/juris-test en prod devolvian 0 resultados; local devolvia 6). El chequeo
  previo "data/corpus-full 404 = no expuesto" era falso consuelo: no existian en
  el lambda.
- **Fix**: `vercel.json` -> `functions."api/index.ts".includeFiles: "data/**"`.
- **Corpus full**: dataset HF re-descargado (pablobenavidesj/doctrina-...,
  79.8 MB). `corpus_ingest_full.py` con modo FULL (default): se relaja el filtro
  de Fase 1 (ya no exige fallo rector o concordancias como condicion de entrada);
  siguen el saneo de institucion (>= 3 palabras, anti-prosa, anti-cita), dedup
  por institucion y cap de contenido en 2500. Resultado: **5706 fichas**
  (laboral 456 · civil 532 · familia 618 · penal 811 · administrativo 80 ·
  constitucional 550 · transversal 2659). Modo estricto previo disponible con
  `CORPUS_MODE=base`.
- **QA**: tsc 0 · local 13/13 PASS · prod verificado: juris-test 6 fichas
  (base) y 8 fichas con `area=penal` (prision preventiva, archivo penal.json).
- Endpoints: `/api/juris-test` acepta `area` opcional (QA de corpus por area
  contra prod sin costo).
- Pendiente del dueno: credencial MP de PRODUCCION (APP_USR-). Con la clave de
  desarrollador (TEST-) las compras son sandbox y no desbloquean dictamen.

## juris-test sin area ahora detecta por keywords (2026-10-28)

El default de `/api/juris-test` caia a la base laboral pura (disenio Fase 1),
lo que hacia parecer que "el corpus solo tiene lo laboral". Ahora, sin area
declarada, detecta el slug del corpus por keywords (`detectAreaFromContext`),
mismo camino que el dictamen premium (server.ts ~633). Verificado en prod:
laboral/penal/civil detectados -> 8 fichas cada uno. Con area declarada, gana
el area explicita.

## Fase 6 - Actualizacion continua del corpus (2026-10-28)

1. **`scripts/corpus_update.py`**: orquestra 1 comando (y el cron lo usa):
   - Descarga el snapshot HF vigente y compara **sha256** contra `.corpus-version`
     -> sin delta: exit 0 sin regenerar ni commitear (cero deploys inutiles).
   - Con delta: re-ingesta FULL (`corpus_ingest_full.py`) -> **guardia de
     tamaño** (CORPUS_MAX_MB, default 100; hoy 16.9 MB) -> **candado QA**
     (qa-corpus-fase5, 13/13; falla = exit 1 y el workflow aborta SIN commit/push)
     -> guarda nueva `.corpus-version` (hash + fecha + totales por area).
2. **`.github/workflows/corpus-update.yml`**: corre el día 3 de cada mes 06:00
   UTC + disparo manual. Si commitea, Vercel despieza automaticamente (repo
   vinculado). Python 3.12 + node 24 en ubuntu-latest.
3. **Recency boost** (`jurisprudenciaChile.ts`): fichas con fallo rector del
   año en curso ganan empates sutiles en el scorer (max +0.15, decay
   1/(1+0.8*aniosAtras)) -> "criterio vigente" se filtra arriba en ties, sin
   perturbar el orden general (QA 13/13 y validador 7/7 re-corridos).
4. **Verificaciones**: corpus_update idempotente (2da corrida = "Sin
   cambios"); primera corrida OK (5706 fichas, 16.9 MB, QA verde). Prod:
   juris-test laboral 8 fichas. Commit `da3de22`.
5. Nota: la fuente sigue siendo el dataset doctrinal de Open Legal Chile en
   HF (se actualiza cuando su autor lo hace). Fallos crudos recien dictados
   (PJUD/OJV directo) quedan como Fase 7 candidata si el dataset se atrasa.

## Fase 7 - Plazos con codigo y gate premium (2026-10-28)

1. **`plazosChile.ts`** (motor determinista, cero LLM): dia por dia con
   regla CPC 251 (corrige en el dia siguiente de transcurridas 24h), sab/dom
   inhábiles, feriados ley 2977 completos + movilos (Pascua Meeus),
   **vacaciones judiciales civiles** (feb suspende, art. 70 CPC; laboral y
   familia no suspenden) y tabla de emplazamiento arts. 258/259 (+2 dias por
   cada 100 km o fracción >50). 6 plazos registrados con fundamento. Los
   escenarios fuera del registro devuelven [VERIFICAR]: jamas un numero
   silencioso. QA **17/17** (escenarios con feriados de septiembre 2024,
   vacaciones feb, emplazamiento km 400, feriado movil Viernes Santo 2024).
   Conectado a borrador: `PLAZO_POR_TIPO` (contestación civil/laboral con
   notificación detectada en el relato) -> bloque "PLAN DE PLAZOS" en prompt +
   `metadatos.plazosMotor` en la salida para la UI/QA.
2. **Gate premium B+C híbrido** (decisión: gratuito siempre como anotación;
   el dictamen pagado se retiene apenas por errores de bulto): `hallazgosBloqueantes()` en `validadorInforme` bloquea con 422 SOLO dos
   hallazgos verificables por código: (a) marcadores "XX" crudos, (b) RIT/RUC
   del encabezado ausente en el documento/dictamen del caso (rol heredado o
   inventado). El resto sigue siendo ANOTACIÓN (rol no en corpus, art. sin
   BCN y monto no corroborado son probabil(políticas)), SALIMOS antes del
   `consumeUse`: el caso bloqueado NO gasta uso. Nota: el dictamen traído de
   caché no re-valida (ya pasó el gate al crearse).
3. **Harness de tasa de error** (`qa-tasa-error-fase7.ts`): línea base
   determinista sobre 15 casos REALES de `jurisprudencia-casos.json` con
   defectos inyectados rotados (RIT heredado/XX/rol fuera/monto bajo desde
   0/limpio). Checa que el gate bloquee SIEMPRE lo grave y NUNCA lo que es
   anotación (falsos positivos=0). Resultado **2026-10-28**:
   `gateAccuracy=1.0` · `plazosConsistencia=1.0` -> `data/baseline-fase7.json`.
   Preparado para calibrar con demandas privadas lokales (.gitignore) y modo
   --llm cuando toque.
4. **E2E prod**: /legalhelp/draft contestación laboral con "notificada el 12
   de marzo de 2024" -> limite motor 2024-04-03 (EL MOTOR detectó Viernes
   Santo 29-03-2024, algo que un LLM calcula mal con frecuencia) +
   /juris-test 8 fichas. Deploy `0acd35e`.
5. Conocido donde NO debe aplicarse: /api/analyze (gratuito) sigue sin
   capas (por decisión de funnel); embeddings (Fase 8) quedan pendientes según
   lo puesto con el usuario, tras pisar esta línea base.

## Fase 7 (cierre de gaps de la auditoria) - 2026-10-28 - deploy `9f843ec`

1. **GAP 1 - cross-check de fechas (enforcement ANOTACION)**: `chequearPlazosEnBorrador()`
   compara la fechaLimite del motor contra el borrador final en 5 formatos (ISO,
   dd-mm-yyyy, dd/mm/yyyy, "3 de abril de 2024", "… del 2024") normalizados sin
   tildes. Si el borrador NO consigna la fecha del motor, se appenda una nota de
   verificación visible y se expone `metadatos.chequeoPlazos[].consignado`.
   NUNCA bloquea (decisión: los borradores gratuitos no bloquean por falso
   positivo). QA plazos passa a 20/20 (chks 18-20).
   E2E prod: motor 2024-04-03 (Viernes Santo detectado), corrida real con LLM
   que NO consignó la fecha → detectada consignado:false + nota añadida. Esto
   es justamente el caso que el "prompt-instruction-only" anterior no cubría:
   ahora hay medición, no promesa.
2. **GAP 2 - A/B del recency boost (verificado con números)**: REC_MAX_W ahora
   es env-overridable (`RECENCY_W`, default 0.15) + override por llamada para
   el QA. `qa-recency-fases7.ts` (6/6): 5 consultas x top-30 con W=0 vs W=0.15
   → efecto existe, magnitud acotada (maxDelta=0.03 <= 0.2), ninguna ficha
   empeora, delta coincide con la fórmula 0.15/(1+0.8*años) (tol 0.03 por
   redondeo), dirección correcta (más reciente = mayor delta).
   **Honestidad sobre cobertura**: del corpus completo SOLO ~98/5.706 fichas
   traen `falloRector` (limite del dataset HF). En la muestra A/B (150 fichas
   top), 6 sufrieron el boost. El boost es real y funciona como diseñado, pero
   su alcance en el ranking agregado es pequeño de facto. Además se amplió el
   parseo para fechas año-solo ("2023").
3. **GAP 3 - auto-deploy VERIFICADO**: `vercel inspect` del deploy de 17min
   muestra alias `dialegal-git-main-...` (deploy disparado por GitHub push,
   no por CLI) y juris-test=8 en él: includeFiles data/** intacto en el flujo
   git. El 1er run real del workflow `corpus-update.yml` sigue pendiente
   (cron día-3 o "Run workflow" desde la pestaña Actions — no gh CLI local).
   Riesgo residual: pip/npx en ubuntu del runner sin probar (probable OK).
4. **Caveats que siguen abiertos (honestidad)**: (a) gateAccuracy=1.0 es
   consistencia interna determinista, NO tasa de error real (necesita
   demandas privadas del usuario / modo --llm); (b) fundamentos de los 6
   plazos (CPC 258/107/486, CT 446/533, Ley 19.968 art.51) NO contrastados
   contra BCN aún; (c) sandbox de MP no probado con compra real; (d) ~5.000
   fichas descartadas del corpus son filtro heurístico, no revisadas a mano.

## Riesgo 2 (Fase 2/5 riesgos) - Auditoria de ingesta falloRector - 2026-10-28

1. **Hallazgo con numeros (scripts/audit-fallo-rector.ts -> evaluation/jurisprudencia/audit-fallo-rector.json)**:
   dataset crudo HF = 11.858 filas; solo **104 (0,88%)** traen `fallo_rector`
   no vacio; **104/104 parsean rol+fecha** (0 parciales, 0 vacios) -> el
   parser NO tenia defectos: no se reparo por que no habia nada que reparar.
2. **Causa raiz de la perdida real (reconciliacion exacta)**: 104 filas ->
   91 roles unicos -> 86 roles en produccion (91-5=86 EXACTO). Las 5 fichas
   CON rector perdidas eran falsos positivos del filtro `institucion_prosa`
   (titulos dogmaticos que terminan en "del X"/"de la X": "...Teoria del
   Emplazamiento", "...Primacia de la Realidad"). 566 colas en minuscula =
   prosa real (correctamente descartadas); las 5 perdidas tienen la palabra
   final en Mayuscula. Medido con el regex PYTHON de produccion, no con proxy.
3. **Fix quirurgico**: corpus_ingest_full.py + juris_ingest_laboral.py ya no
   descartan por prosa una fila que trae `fallo_rector` parseable (el
   heuristico de titulo no mata fichas cuyo campo juridico ya se extrajo).
   Alcance medido: solo cambia el trato de filas con rector; las 566 prosas
   reales siguen fuera.
4. **Regeneracion y verificacion**: corpus-full 5.706 -> **5.711 fichas**
   (civil 532->535, laboral 456->457, transversal 2.659->2.660); los 5 roles
   recuperados verificados presentes (4821-2019, 18940-2019, 24312-2018,
   33190-2020, 33102-2019). 1 perdida NO reparable: institucion duplicada en
   el dataset con 2 roles distintos ("El Principio de Juridicidad..." con
   45120-2017 y 17890-2020; el dedup conserva 1) — aceptada y documentada.
   QA after: corpus 13/13 PASS, recency 6/6 PASS (maxDelta 0,04, ninguna
   ficha empeora). RECENCY_W NO tocado (orden de la fase respetada).
   Rollback determinista = `git revert` de los 4 JSON de datos + 2 .py.
5. **Queda estructural (honestidad)**: el boost recency sigue limitado por
   la fuente (~103/5.711 fichas con rector, ~1,8%): los datos crudos no
   traen mas rectores y NO hay rescatables en texto (0 hallados). Ampliar
   cobertura exigiria otra fuente (ingesta BCN / scraping PJ) — fuera del
   alcance de este riesgo; queda como limite documentado, no como promesa.

## Riesgo 3 (Fase 3/5 riesgos) - Auditoria de fichas descartadas - 2026-10-28

1. **Numeros reales (scripts/audit-descartadas.ts -> evaluation/jurisprudencia/audit-descartadas.json)**:
   descartadas total **4.993** (institucion_corrupta 2.212 · institucion_prosa
   1.854 · corrupta_cita 920 · ambiental_fuera 7) — concilia exacto con la
   corrida de produccion (el auditor replica la cadena FULL en TS con regex
   unicode-aware; diffs 0 contra el clasificador Python fila por fila,
   verificado sobre las 11.858).
2. **Muestra estratificada determinista de 100 fichas** (28/30/25/7,
   seleccionadas por POSICION del archivo, reproducible sin azar), cada una
   con motivo + institucion + len_definicion + concordancias + cabeza de
   definicion + `decision_humana: pendiente_revision_humana`.
3. **Señal automatica declarada**: "probable FN" = parece_titulo (mayuscula
   inicial, >=3 palabras, termina en palabra) AND sustancia (definicion
   >=120 + concordancias). Resultado señal: prosa 4/30 (13,3%),
   corrupta_cita 6/25 (24%) → umbral >=5% del mandato Activado.
4. **Revision humana de los candidatos (10/10 revisados a mano)**: 9/10 NO
   son FN: bibliografia cortada ("HOLMES, Stephen y SUNSTEIN (2011)...",
   "ALEXY, Robert (2001)..."), prosa real ("Sentencia de la Corte Suprema,
   24 de septiembre de 2018..."), 1 FN aparente ("Determinacion de la
   maternidad"). La SENAL sobrestima FN (le falta detectar cita
   bibliografica) — las metricas de señal NO son veredicto.
5. **Cambio propuesto, probado y RECHAZADO**: generalizar la excepcion de
   prosa a colas-mayuscula con sustancia (sin requerir rector). REGRESsion
   medida: liberaria 43 filas; revision COMPLETA a mano (no muestra): ~20
   titulos legítimos vs ~23 prosas ("Para Frieyro (2017: 182)...", "Por
   ejemplo, el Segundo Juzgado de Letras del Trabajo...", dups) -> precision
   ~47%, inaceptable para el matcher. REVERTIDO antes de dejar software
   con datos contaminados: los filtros quedan como en el estado post-Riesgo
   2 (5711 fichas, prosa 1854, verificacion de regeneracion igual a la
   corrida anterior).
6. **Propuesta concretas que QUEDAN documentedas (NO aplicadas, exigen su
   propia validacion)**: (a) canonicalizacion de titulos prosa-bibliografia
   (extraer el concepto de la cita antes de indexar) — requiere nueva
   capa de parsing y tests propios; (b) liberacion POR LISTA blanca manual
   de los ~20 titulos legítimos identificados (determinista, cero
   contaminacion, sin heuristica); (c) auditoria de los 699 cola-minuscula
   con sustancia (38% de la subpoblacion) como trabajo separado.
7. **Veredicto honesto**: NO hay evidencia de que el pipeline este
   perdiendo fichas de calidad de forma masiva. FN aparentes en muestra:
   1/100 revisados (1%); los heuristicos descartan sobre todo ruido real
   (bibliografia, prosa, titulos rotos). Regeneracion final verificada, QA
   corpus 13/13, recency 6/6, tsc 0.

## Desbloqueo admin del premium server-side (2026-10-29)

Sintoma reportado por el dueño: "no genera el analisis premium cuando ingreso
el codigo del desarrollador 4321" en legalhelp.cl.

1. **Diagnostico (cadena de evidencia)**: el campo "Codigo Administrador" del
   modal vivia SOLO en el frontend (`atob('NDMyMQ==')`, PaymentModal.tsx) y al
   aceptar llamaba `onSuccess()` sin crear orden ni `orderId`. El efecto
   premium de App.tsx enviaba `orderId: undefined` a `/api/premium-report`,
   que desde el paywall Fase 3 responde 400 ("orderId es requerido",
   verificado en prod) -> `premiumFailed` -> banner rojo. Comportamiento
   DOCUMENTADO como intencional en Fase 3 punto 4; NO era una caida del
   servicio (home 200, juris-test 200, orderStore respondiendo).
2. **Solucion**: nuevo endpoint `POST /api/payment/admin-unlock` que valida el
   codigo contra la variable de entorno `ADMIN_UNLOCK_CODE` (Vercel
   Production, NO hardcodeada en el repo; comparacion timing-safe con
   `crypto.timingSafeEqual` y trim defensivo) y crea una orden de cortesia
   aprobada con `usos: 0` (tope de 3 usos del F3 aplica igual). Rate limit
   estricto `admin-unlock:<ip>` = 5/min (override `ADMIN_UNLOCK_RATE_LIMIT_MAX`
   para QA). El modal ahora hace fetch al endpoint, usa el `orderId` devuelto
   (solo en memoria, NO pisa `pjud_legal_last_orderId` de un pago real) y con
   codigo valido sin servidor disponible muestra error en vez del exito falso.
3. **Hallazgo colateral (sin cambiar, decision del dueño)**: el campo del
   codigo se muestra en produccion a cualquier visitante; el dueño decide
   mantenerlo ("solo yo se el codigo pero sigue siendo 4321"). Riesgo
   residual honesto: 4321 es adivinable y fuerza bruta solo la frena el
   rate limit de 5/min/IP.
4. **QA e2e local** (`scripts/qa-admin-unlock.ts`, servidor tsx :3210, memoria
   por ausencia de Docker Postgres): 5/5 PASS — 401 codigo malo; 401 sin
   codigo; 200 + orderId `ADMIN-*` con codigo bueno; premium sin orderId
   sigue 400; premium CON orden de cortesia generacion real 200
   (10.637 chars, grounded=true, 31,2 s; usosRestantes null = degradacion
   F3.3 documentada). Suite de regresion: plazos 26/26, gate 5/5,
   tasa-error OK (gateAccuracy=1), corpus 13/13, validador 7/7,
   eval-gate accuracy 1.0, tsc 0, build 0.
5. **Deploy + verificacion prod** (`npx vercel --prod --yes`, aliased
   legalhelp.cl): codigo malo 401; codigo bueno 200 con orden
   `ADMIN-cc01d1e6-75f5-4410-9080-3d7a716ba8ac`; premium real con esa orden
   200 en 29,7 s, 13.580 chars, grounded=true.
6. **Incidente de tooling (resuelto)**: `vercel env add` por stdin/pipe
   en Windows PowerShell guardo el valor VACIO dos veces (pull mostraba
   `ADMIN_UNLOCK_CODE=""`); el flag `--value <VAL> --no-sensitive` lo dejo
   correcto. Nota: por defecto Production crea vars SENSITIVE y `vercel env
   pull` no las devuelve (escribe "") — por eso se uso `--no-sensitive`
   para poder verificar el largo almacenado (4).
7. **Pendiente honesto**: en prod NO hay DATABASE_URL (accion pendiente del
   dueño, F3.3), de modo que `usosRestantes` vuelve null y el tope de 3 usos
   NO se aplica entre lambdas: la orden de cortesia vive en la memoria de la
   lambda que la creo. El tope funcionara al crear Vercel Postgres/Neon.

## Fase 8 - Calidad del retrieval jurisprudencial (2026-10-29)

Disparador: verificacion en vivo contra prod mostro basura administrativa
encabezando el retrieval ("Chequear diariamente el encendido y apagado" top-1;
"Suministro de mano de obra" tapando la ficha correcta de despido art. 161).

1. **Auditoria antes de tocar nada** (`scripts/audit-corpus-calidad.ts` ->
   `evaluation/jurisprudencia/audit-corpus-calidad.json`): de 5.711 fichas,
   1.906 candidatos a relleno (33,4%): truncada 1.825 + infinitivo_inicio 81.
   Revision manual de muestra estratificada de 34: ~26-28 basura clara (~80%
   de precision) y las "borderline" igual traen titulo roto. Composicion del
   corpus: Academia Judicial 4.579/5.711 (80,2%); solo 103 (1,8%) con fallo
   rector citable; `operativaProcesal` en 41 fichas (campo muerto hasta hoy);
   contenido p50=2.500 chars.
2. **Procedencia de "casos anologos" rastreada (miedo descartado)**: los
   3.135 "ficha_cs" y 303 de TC de `data/jurisprudencia-casos.json` tienen
   roles/caratulas REALES (ej: "1039-2025", "LABARCA/VILLEGAS"). Los
   sospechosos son SOLO 6 entradas semilla de `pjud_connector.FALLOS_RECTORES_
   CHILE` (demo hardcodeado del paquete: roles redondos 23.456/45.123/12.890/
   34.567/89.124/9876, caratulas genericas). Decision: denylist en codigo
   (`ROLES_SEMILLA_NO_CITABLES`), NO borrado del data file (procedencia
   visible); nunca salen en "casos anologos".
3. **Degradacion con fallback, no exclusion dura** (leccion Fase 3): las
   fichas-relleno se detectan con `esFichaRelleno()` (patron infinitivo-inicio
   o titulo truncado; guard: con falloRector NUNCA es relleno) y solo ocupan
   cupos restantes tras las sustantivas. El flag `relleno` es observable en
   `resumenJuris`/juris-test para verificacion en prod.
4. **Doctrina al prompt**: `bloquePromptJuris` ahora agrega `contenido`
   (900 chars) y `operativaProcesal` (300 chars) por ficha; cota del bloque
   con 6 fichas ~9.7k chars (menor que el dictamen que ya viaja). Antes el
   contenido completo solo scoreaba y el LLM veia 420 chars de definicion.
5. **Fase 8b - causa raiz del ranking malo medida, no adivinada**: desglose
   por token mostro que una ficha base de 46.077 chars repite "empresa" 39
   veces y `mapa[t] += peso` por CADA repeticion le daba ~80 puntos con UN
   token comun (top-1 "Suministro" 136.55 vs ficha correcta 115.60). Fixes:
   (a) **saturacion de TF** en `agregar` (cap 3x el peso de region, estandar
   BM25); (b) **ventana de proximidad** `bonusVentana` (par de tokens de la
   consulta que co-ocurren dentro de 12 palabras suma 0.5xIDF-del-par, cota
   8; generaliza el bigrama exacto que moria con stopwords intercaladas
   "plazo para contestar"); (c) **dedup base/full** (la misma institucion
   salia 2 veces gastando cupos; `fusionar` multi ya deduplicaba).
6. **Medido antes/despues** (`scripts/_probe_proximidad.ts`, corpus real):
   control-despido top-1 pasa de "Suministro" (136.55) a "Terminacion por
   Necesidades de la Empresa (Art. 161 CT)" (123.60, Suministro cae a 40.86);
   "requisitos ley 21.643" top-1 pasa a "Ley Karin (Ley N° 21.643)";
   paráfrasis "desvinculado" pasa de "agentes quimicos" a "Indemnizacion por
   falta de aviso previo"; coloquial "me echaron" pasa de basura (111) a
   doctrina laboral real (30). Honestidad: `bonusVentana` SOLO sumaba +3.9 a
   +8 y NO invertia rankings — la inversion la provoco la saturacion de TF.
7. **Residuales documentados**: (a) consulta "plazo para contestar la
   demanda" en civil sigue encabezada por fichas Q&A de Academia Judicial —
   la ficha ideal no existe en el corpus; (b) no hay capa de sinonimos
   ("echaron" no conecta con "despido") — eso es embedding/vecinos, trabajo
   futuro con su propia medicion.
8. **QA y verificacion**: `scripts/qa-retrieval-fase8.ts` **38/38 PASS**
   (unidades de deteccion, 6 consultas e2e sin relleno en top-8, fallback
   probado por contrato [nunca vacio + relleno solo al final], semillas fuera
   de resultados, unidades y e2e de ventana/saturacion/dedup). Suite
   regresion: plazos 26/26, gate 5/5, tasa-error OK (gateAccuracy=1),
   corpus 13/13, validador 7/7, eval-gate 1.0, tsc 0, build 0. Probes
   temporales eliminados antes del commit.
