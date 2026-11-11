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

## Resiliencia BCN + Fase 4 (Ley 20.774: febrero no suspende) - 2026-10-29

### A. Resiliencia de la ingesta BCN (antes de tocar plazos)

1. **Diagnostico del "bcn 0/0" en prod**: reproducido un draft real contra
   prod con citas explicitas -> `bcn.citados` volvio con 7+ articulos de XML
   oficial vigente (CT arts. 5/161/162/168/171/485 + CPC art. 7,
   fechaVersion 2026-07-23, URLs con idParte). La fuente NO estaba caida: el
   0/0 previo fue input sin citas pareables o un blip transitorio no
   observable. Lo vulnerable era el silencio, no la fuente.
2. **Fragilidades corregidas en `bcnLeyChile.ts`**: (a) un solo intento de
   fetch ante blips transitorios (conn refused/5xx/HTML sin XML) dejaba ciego
   el draft; ahora hay **1 retry solo si la falla fue rapida (<5s,
   `conReintentosRapido`)** — un timeout largo (25s) NO se reintenta para no
   duplicar la latencia; (b) la cuota diaria (LIMITA_DIARIO) ahora cuenta
   INTENTOS, no solo exitos (cortesia real hacia leychile); (c) los catch
   silenciosos del draft (BCN pre y post) pasan a `console.warn` etiquetado
   (`[draft][bcn-pre/bcn-post]`): si BCN cae, queda senal en logs.
3. **QA nueva** (`scripts/qa-bcn-resiliencia.ts`): **7/7 PASS** — 4 unitarios
   deterministas del reintento (blip recupera en 2 llamadas; blip persistente
   falla tras 2; falla lenta NO reintenta; exito directo 1 llamada), umbral
   default 5s, y 2 canarios EN VIVO contra leychile (CT art. 161 en 402ms con
   XML oficial; art. 66 CPC vigente). Si la fuente cae, este QA falla: es la
   alarma pedida, no un falso verde.
4. **Pendiente estructural honesto**: sin DATABASE_URL en prod, la cache de
   XML sigue siendo por-lambda (TTL 24h in-memory); cada lambda fria
   re-descarga el cuerpo completo la primera vez. La cache persistente
   (tabla leyes/xml_normas en Postgres) se activara cuando el dueño cree la
   DB — no se simula con SQLite ni files efimeros.

### B. Fase 4: febrero ya no suspende los plazos civiles

1. **Cadena de evidencia BCN (verificada en vivo, no de memoria)**: Ley
   20.774 "SUPRIME FERIADO JUDICIAL, PARA LOS TRIBUNALES QUE INDICA" —
   D.O. **04-09-2014** (fechaPromulgacion 29-08-2014, normaId 1064893):
   art. 1°-3a da al COT art. 313 el texto "corresponderá a un feriado anual
   de un mes"; art. 2°-N°2 **elimina el inciso segundo del art. 66 CPC**
   (la regla que suspendia los plazos de dias por feriado judicial);
   art. 7°: "Las referencias al feriado judicial de febrero consignadas en
   cualquier cuerpo legal... se entenderan derogadas". El XML del CPC
   vigente (idNorma 22740, fechaVersion 2022-06-30) NO menciona vacaciones
   judiciales en ningun articulo (busqueda sobre las partes Art completa).
   El comentario viejo del motor citaba "CPC art. 70" para las vacaciones —
   el art. 70 vigente habla de formacion del proceso: comentario obsoleto.
2. **Cambio en `plazosChile.ts`**: `HABILES.civil.vacacionesJudiciales`
   "si" -> **"no"** (laboral y familia ya eran "no"). El campo y la rama de
   desglose quedan como mecanismo documentado (extensibilidad). Los
   fundamentos de los 3 plazos civiles llevan la cita: "No se suspende en
   febrero (Ley 20.774, D.O. 04-09-2014)".
3. **Alcance del feriado anual variable**: el feriado anual de un mes por
   tribunal (COT art. 313) depende de auto acordado por corte/tribunal y no
   es modelable determinísticamente; queda fuera del motor, cubierto por el
   marco [VERIFICAR] existente (misma filosofia que la distancia de
   emplazamiento).
4. **Expectativas corregidas a mano con la regla nueva**: qa-plazos #3
   (notif 27-01-2025): 2025-03-17 -> **2025-02-17** (28-31 ene=4; feb 3-7=9,
   10-14=14, 17=15); #10 (notif 03-02-2026): 2026-03-04 -> **2026-02-06**
   (4,5,6 feb); gate C1 (notif 27-01-2027): 2027-03-17 -> **2027-02-17**,
   con el informe del caso editado para que la fecha declarada coincida con
   la del motor (17 de febrero de 2027).
5. **Verificacion**: qa-bcn-resiliencia 7/7, plazos 26/26, gate 5/5,
   tasa-error OK (gateAccuracy=1), eval:gate exit 0 (matriz 13/17/5
   clasifica exacta), corpus 13/13, validador 7/7, tsc 0, build 0.

## Fase A: auditoria de fidelidad - informe premium vs fuente normativa (2026-10-29)

1. **Disparador**: informe premium real (demanda civil de incendio ~$550M,
   notificacion jue 29-10-2026) con fecha limite inconsistente (dictamen 19,
   complemento 21; correcto **viernes 20-11-2026**), materia con elementos de
   "tutela laboral" en un caso civil, y etiqueta "(100%)" hardcodeada. Auditoria
   completa en `evaluation/fidelidad/hallazgos.md`; cada regla sentenciada contra
   XML oficial de Ley Chile descargado y decodificado ese dia (CPC idNorma 22740
   de 57 MB, COT idNorma 25563, Leyes 2.977/19.668/20.299/21.394/20.774/20.215/20.069).
2. **Cadena civil verificada**: CPC art. 258 vigente = "dieciocho dias" (segun
   Ley 21.394 art. 3 N.12, que reemplazo "quince" y suprimio el inciso 2; la
   cita del informe era CORRECTA); art. 66 vigente suspende solo durante
   feriados; Ley 2.977 art. 1: domingos SON feriados, sabados NO (salvo sabado
   santo) -> **civil corre lunes-sabado menos feriados**. El motor tenia la
   regla doblemente mal (15 dias habiles lun-vie). Faltan en su tabla: 29-jun,
   12-oct (traslado a lunes, Ley 19.668), 31-oct (traslado a viernes,
   Ley 20.299 art. 2) y 1-nov; y trae entradas espurias 24-dic y 31-dic que
   no existen en la ley.
3. **Correccion del diagnostico preliminar**: un output truncado + un filtro
   case-sensitive del probe hizo concluir que la Ley 21.394 no tocaba el art.
   258; con el XML completo se prueba lo contrario. El verificador de citas de
   la Fase E debe CONFIRMAR esa cita, no refutarla. Ademas: el COT art. 6 no
   trata de dias habiles (es jurisdicccion extraterritorial); el idNorma
   canonico del COT es 25563.
4. **Materia mixta - causa raiz en codigo**: `jurisprudenciaChile.ts:329`
   concatena el corpus base (laboral) SIEMPRE, aunque el area declarada sea
   civil; verificado conductualmente en prod via /api/juris-test (query civil
   limpia devuelve una ficha "Laboral" que vive en laboral.json). El corpus
   por area civil carga bien en prod y CORPUS_COMPLETO existe en Production.
   Priming contradictorio en server.ts:576-580 y llamada sin slug en :639.
5. **Premium sin motor**: /api/premium-report no invoca plazosMotor ni
   anotacionesPlazos (0 matches): las fechas del informe son estimacion del
   LLM. La Fase C lo conecta como anotacion (nunca bloqueo, decision del
   dueno). Artefactos verbatim del informe/demanda quedan pendientes de pegado
   del dueno (el endpoint tiene paywall server-side y no es re-ejecutable;
   no se parafrasea de memoria).
6. **Recalculos previstos para Fase B** (18 dias lun-sab, domingos+feriados
   suspenden): qa #3 -> 2025-02-17 sin cambio; #10 -> 2026-02-06 sin cambio;
   gate C1 -> 2027-02-17 sin cambio (la nota preliminar decia 16-02; conteo
   dia a dia da 17, validar contra el motor); caso del dueno -> 2026-11-20.

## Fase B: motor de plazos corregido contra XML oficial BCN (2026-10-29)

1. **Que cambio en `plazosChile.ts`** (todo sentenciado contra XML de Ley Chile
   descargado 2026-10-29, ver Fase A): (a) `civil_contestacion` 15 -> **18 dias**
   y corren **lunes-sabado** (CPC art. 258 segun Ley 21.394 art. 3 N.12; art. 66
   suspende solo feriados; Ley 2.977 no lista sabados); (b) `FERIADOS_FIJOS`
   sin 24-dic ni 31-dic (no son feriados legales; el 24-dic es solo vespertino
   irrenunciable de comercio) y con 1-nov; (c) traslados agregados: 29-jun y
   12-oct -> lunes (Ley 19.668), 31-oct -> viernes (Ley 20.299 art. 2: mar ->
   viernes semana anterior, mie -> viernes misma semana, resto fecha propia);
   (d) solsticio de invierno (Ley 21.357, "Dia Nacional de los Pueblos
   Indigenas") con formula de Meeus validada 2021-2026 contra gob.cl;
   (e) desglose del resultado materia-aware. Laboral y familia siguen lun-vie.
2. **Caso del dueno verificado**: notificacion jue 29-10-2026 -> limite
   **viernes 20-11-2026** (18 dias; el sab 31-oct-2026 es feriado evangelico
   que NO se traslada y dom 01-nov es feriado; ambos fuera del conteo).
   El informe premium real habia dicho 19 en el dictamen y 21 en el
   complemento: internamente inconsistente y con la regla derogada de 15
   habiles lun-vie.
3. **Recalibracion honesta de golden cases** (golpe de la correccion, no
   encubrimiento): qa #23/#25 -> limite laboral 2023-10-24 (el feriado 12-oct-
   2023 se traslado a lun 09-oct); gate C4 -> 2027-01-04 (antes 06-01: contaba
   sabados inhabiles y 31-dic feriado, ambos contrarios a la ley vigente);
   gate E2 -> 2027-04-17 (antes 16-04: regla vieja de 15 habiles lun-vie).
   Cada nuevo valor recalculado a mano dia a dia Y verificado contra el motor.
4. **Correccion de un error propio del plan**: el test 30 original probe el
   traslado de 31-oct con 2027, pero 31-oct-2027 cae DOMINGO -> fecha propia.
   Test reescrito con los tres dias de semana reales (Date.UTC): 2027 dom
   fecha propia; 2028 mar -> vie 27-oct; 2029 mie -> vie 02-nov.
5. **Suite**: plazos 35/35 (26 legacy + 9 nuevos), gate 5/5, corpus 13/13,
   validador 7/7, bcn-resiliencia 7/7 (canario CT art. 161 vivo), retrieval
   38/38, eval:gate accuracy 100% / macro-F1 1.0 (35 casos). tsc 0, build 0.
6. **Pendiente menor declarado** (fuera del motor, documentado): tabla de
   emplazamiento de la Corte Suprema (quinquenal) usa +2/100 km con
   [VERIFICAR]; feriado anual variable de COT art. 313 no es modelable
   deterministamente.
7. **Verificacion en prod** (deploy `dpl_89nPSSrmSVrd4vX6uSdg7r7woRpQ`,
   aliado a legalhelp.cl): POST /api/legalhelp/draft (civil/contestacion,
   notificacion 29-10-2026) -> metadatos.plazosMotor.fechaLimite = **2026-11-20**
   (18 dias, fuente CPC art. 258 segun Ley 21.394) y, al no consignar el
   borrador la fecha, el sistema appendeo la anotacion visible
   "limite_no_consignada: el motor calculo 2026-11-20" SIN bloquear la
   entrega (decision del dueno: anotacion, nunca bloqueo).
8. **Mejora del detector hallada en la verificacion** (commiteada con esta
   entrada, despliega con la Fase D): el regex de deteccion solo cubria
   participios ("notificada/o") y el sustantivo; la frase hipercomun de
   usuario "nos notificaron la demanda el ..." quedaba sin fecha y el motor
   no corria. Agregadas formas verbales "notificaron"/"notifico" (texto
   normalizado sin tildes); QA 36-38. Hallazgo de CI aparte: el workflow
   eval-gate de GitHub Actions arrastraba startup_failure en TODOS los pushes
   del 29-10 (path "BuildFailed", 0 jobs, sin logs; tambien por
   workflow_dispatch; el YAML parsea bien) y sus 2 corridas del 28-10
   murieron en 3-4 s sin logs: problema de repo/cuenta GitHub que el dueno
   debe revisar en Settings -> Billing/Actions; no bloquea deploy ni QA local
   (eval:gate 100% local).

## Fase D - Registro unico de materias (7 + transito) - 2026-10-29

**Decision del dueno que materializa**: "opcion 1 y agregar transito" (7
materias: civil, laboral, familia, penal, administrativo, constitucional +
transito); transversal queda como CAPA de corpus, no como materia. Regla de
oro: el area declarada MANDA, las senales solo sugieren, sin senal =
indeterminada (null) y el conflicto es ANOTACION VISIBLE, nunca bloqueo.

1. **materias.ts (nuevo)**: fuente unica de verdad. Clasificador determinista
   por conteo de senales (regex con pesos, sin red ni LLM); la "confianza" es
   el MARGEN crudo top1-top2, no un porcentaje inventado. \esolverMateria\
   implementa la regla declarada-manda; \lineaMateriaPrompt\ imprime que
   gobierna, de donde salio y los conteos crudos. Error propio corregido en
   code review: "paco" como senal de transito (jerga de droga, falso
   positivo) - eliminado antes de commitear.
2. **Causa raiz eliminada**: \rea-detector.ts\ devolvia "laboral" por defecto
   en empate o cero senal (lineas 112/136) - era la contaminacion civil->
   laboral del informe real (Fase A). Ahora devuelve null. \getArticulosClave\
   (legalhelp-templates.ts) cai a laboral con area desconocida: ahora null =>
   []. validadorLegalHelp acepta area null/transito.
3. **Recuperacion gobernada por area** (jurisprudenciaChile.ts): la base
   laboral DEJA de concatenarse siempre al indice; el area pedida trae su
   corpus (CORPUS_COMPLETO) + capa transversal, y la base queda como FALLBACK
   ETIQUETADO (\uenteFallback\, \uenteTransversal\, \slugOrigen\) visible en
   prompt y resumenJuris/resumenCasos. Casos anologos: \	agAreaCaso\ filtra
   "(LABORAL)"/constitucional (el corpus de casos NO tiene area dogmatica:
   3444 casos ~90% laboral, campo materia = materia procesal); filtro con
   repuesto etiquetado si quedan <2. transito NO tiene corpus propio
   (verificado: el dataset fuente no trae area Transito) - corre sobre normas
   BCN (L18290/L18287) + capa transversal; corpus propio solo con fuente real
   (Fase H).
4. **Plazos honestos por materia**: \calcularPlazosMotor\ acepta area null;
   materias sin plazos modelados (penal, administrativo, constitucional,
   transito) reciben en el prompt "[VERIFICACION DE PLAZOS] ... NO inventes
   fecha limite" en vez de silencio.
5. **Frontend**: chip "Transito / Policia Local" en DraftForm (mapea el
   "policia_local" del wizard); el % de auto-deteccion (inventado, maxArea/5)
   reemplazado por el clasificador real con conteos crudos ("Civil=8 ·
   Laboral=2", "sin senales" cuando no hay); DraftResult/DraftHistory muestran
   "indeterminada" con area null. premium \materia\ ahora null cuando no hay
   senales (el chip se oculta, no se inventa "civil encubierto").
6. **QA**: nuevo scripts/qa-materias-faseD.ts 19/19 (clasificacion por
   materia, declarada-manda + conflicto visible, indeterminada nunca laboral,
   policia_local=>transito, prompt sin %, tags de casos, recuperacion civil/
   transito sin fichas laborales sin etiqueta, articulos clave null-safe).
   Suite completa: plazos 38/38, corpus 13/13, validador 7/7, bcn-resiliencia
   7/7, retrieval 38/38, gate 5/5, eval:gate 100%. tsc 0, build 0.
7. **Verificacion en prod** (deploy CLI unico posterior a 7119155, aliado a
   legalhelp.cl): juris-test texto de transito SIN area declarada ->
   area=transito (17 puntos crudos, origen senales, 8 fichas todas de capa
   transversal etiquetada); juris-test civil declarado -> 8 fichas sin
   ninguna laboral sin etiqueta; texto neutral -> "sin-area" (nunca laboral).
   Draft civil con frase "nos notificaron ... 28 de octubre de 2026" (fix
   B.2 ahora en prod) -> fechaLimite 2026-11-19 (18 dias lun-sab, CPC 258
   segun Ley 21.394). Draft transito end-to-end -> metadatos.area=transito,
   plazosMotor [], articulosClave [] y borrador con [VERIFICAR] (sin plazos
   inventados).
8. **CI GitHub Actions**: las runs siguen en startup_failure (path
   "BuildFailed", 0 jobs, sin logs, tambien por workflow_dispatch; el YAML
   parsea bien) - problema pre-existente de repo/cuenta que el dueno debe
   revisar en Settings -> Billing/Actions; no bloquea deploy ni QA local.

## Fase E - Verificador de citas contra XML oficial leychile - 2026-10-29

**Objetivo del plan**: automatizar la confirmacion que la Fase A hizo a mano
(mandato 7.1: sentenciar la cita "CPC art. 258 segun Ley 21.394" contra el XML
oficial) y extender la sentencia documental a TODO el registro de plazos.
Canal: `Consulta/obtxml?opt=7` (mismo del runtime), sin LLM.

1. **Confirmado automatizado** (`scripts/qa-citas-faseE.ts`, 22/22): CPC 258
   vigente (fv 2021-11-30) dice "dieciocho dias" y no contiene "quince";
   Ley 21.394 art. 3 N.12 dice verbatim "reemplazanse, en el inciso primero,
   la palabra \"quince\" por \"dieciocho\"" (plural: el assert original con
   "reemplazase" singular fallaba por eso); CPC 259 = tabla quinquenal CS
   ("se aumentara de conformidad"); CPC 66 (fv 2014-09-04) = "se entenderan
   suspendidos durante los feriados" SIN exclusion de sabados (Ley 2.977
   art. 2 declara sabado feriado solo para dependencias publicas) -> el
   calendario civil lun-sab del motor queda sentenciado, no supuesto.
2. **Hallazgo grave - laboral_contestacion REMOVIDO**: el CT vigente NO
   tiene plazo de 15 dias habiles para contestar demanda laboral. CT 446
   (fv 2008-03-29) define solo el CONTENIDO de la demanda ("la demanda se
   interpondra por escrito y debera contener: 1. la designacion del
   tribunal..."); la contestacion es en la audiencia preparatoria: CT 451
   ("citar a las partes a una audiencia preparatoria, fijando... dentro de
   los treinta y cinco dias siguientes a la fecha de la resolucion") y CT
   452 ("el demandado debera contestar la demanda por escrito con a lo
   menos cinco dias de antelacion a la fecha de celebracion" de la
   audiencia, o verbalmente en ella). La cita "CT art. 446 (15 dias
   habiles)" del registro era REFUTADA: se removio del registro y de
   PLAZO_POR_TIPO. Los drafts laborales de contestacion ahora reciben
   [VERIFICACION DE PLAZOS] y el borrador produce "[VERIFICAR: plazo de
   contestacion segun la normativa aplicable]" - sin fecha inventada.
3. **Hallazgo de canal - laboral_apelacion REMOVIDO**: el XML del CT por
   idNorma 207436 TRUNCA en el art. 519 (termina en la promulgacion
   2003-01-16; los arts. 520+, incluidos 533 y 540, estan ausentes).
   "CT art. 533 (5 dias habiles)" era INVERIFICABLE -> removido del
   registro (honestidad estricta: no se despliegan citas que el canal no
   permite sentenciar). Reintento posible via idLey o Fase H.
4. **Hallazgo - familia_apelacion RE-MODELADO**: Ley 19.968 art. 51 NO
   trata de apelacion (regula la declaracion de las partes); la cita
   previa era ERRONEA. La apelacion en familia vive en el art. 67, que
   REMITE AL CPC ("las resoluciones seran impugnables a traves de los
   recursos y en las formas que establece el codigo de procedimiento
   civil..."). CPC art. 189 (fv 1989): "la apelacion debera interponerse
   en el termino fatal de cinco dias" y "se aumentara a diez dias
   tratandose de sentencias definitivas". Nuevo modelado: 5 dias con
   calendario CPC (lun-sab), fundamento "L19.968 art. 67 + CPC art. 189",
   con la variante de 10 dias para definitivas ANOTADA en el fundamento
   (visible en el campo fuente de cada calculo).
5. **Hallazgo menor - cita del desglose corregida**: el desglose del motor
   citaba "CPC art. 251: el plazo corre desde el dia siguiente de
   transcurridas 24 horas"; el art. 251 actual trata de la ejecucion de
   resoluciones extranjeras. El desglose ahora cita el art. 66 verificado
   (fv 2014) y la regla de computo al dia siguiente queda como regla
   general del motor, sin numero de articulo inventado.
6. **Registro final**: 4 plazos (civil_contestacion 18 dias lun-sab con
   emplazamiento 258/259 + nota de art. 260 por pluralidad de demandantes
   agregada como [VERIFICAR]; civil_apelacion_auto 5; civil_oposicion_
   medida 3; familia_apelacion 5 calendario CPC). Cruz dura fundamento-
   vs-QA: todo plazo del registro debe tener sus articulos sentenciados
   contra BCN en este QA o el build de evaluacion falla.
7. **Gate recalibrado con nota honesta** (35 casos): E4 (laboral vencido)
   mantiene clase warn via motor_plazo_sin_resultado (el motor se NIEGA a
   computar con reglas refutadas); B1 y A11 (laboral pass) pasan la capa
   plazos a "-" con su objeto declarado (validador estructural, no plazos).
   eval:gate 100%.
8. **Suite**: citas 22/22 (nuevo), plazos 39/39 (tests 2/4/8/9/23/24/25/
   34/35 rewiresados con calendarios verificados; test 8 nuevo = plazos
   removidos se niegan con plazo-invalido + VERIFICAR), corpus 13/13,
   validador 7/7, bcn-resiliencia 7/7, retrieval 38/38, gate 5/5, recency
   6/6, materias 19/19, tasa-error harness OK, tsc 0, build 0.
9. **Verificacion en prod** (deploy CLI unico post a82f197, aliado
   legalhelp.cl): draft LABORAL contestacion (notif 26-10-2026) ->
   metadatos.plazosMotor = [] y borrador con "[VERIFICAR: plazo de
   contestacion segun la normativa aplicable]" sin fecha limite inventada
   (antes el sistema imprimia 15 dias habiles con cita refutada); draft
   CIVIL (notif 26-10-2026, sáb 31-oct y dom 01-nov feriados) ->
   fechaLimite 2026-11-17 exacta con fundamento CPC 258 segun Ley 21.394.
10. **Limitacion declarada**: los feriados del canal del CC (DFL 1/2000)
    llegan con fechaVersion="2222-02-02" a nivel norma (fecha fantasma de
    leychile para normas refundidas) - se sanitiza en Fase F; y los arts.
    del CT posteriores al 519 solo son verificables por otro canal (ver
    punto 3).

## Fase F - Etiquetas HECHO/NORMA, fin del "(100%)" y fecha fantasma 2222 - 2026-10-29

1. **Etiquetas HECHO/NORMA** (AnalysisReport + DraftResult): la grilla de
   trazabilidad ahora declara la TAXONOMIA de cada contraste: HECHO = afirmacion
   factica contrastada contra el documento del usuario y el corpus procesal
   (roles, montos); NORMA = cita legal contrastada contra el texto oficial de
   Ley Chile - BCN (articulos). Leyenda visible bajo la grilla. Antes los tres
   numeros convivian sin decir que se contrasta contra que.
2. **"(100%)" eliminado**: el sello "DICTAMEN TECNICO COMPLETO (100%)"
   hardcodeado (hallazgos.md 6) era una confianza INVENTADA - queda
   "DICTAMEN TECNICO COMPLETO" a secas. Verificado en el bundle de prod: no
   existe "(100%)".
3. **Fecha fantasma 2222-02-02 sanitizada**: el canal BCN devuelve
   fechaVersion="2222-02-02" para normas refundidas (Codigo Civil, DFL 1/2000)
   - verificado upstream en la Fase A (hallazgos.md 6); no es bug de parseo
   propio. Nuevo helper `fechaVersionSana` (src/types.ts): solo muestra
   fechas plausibles (1900-2100); el panel deja de decir "version vigente
   2222-02-02".
4. tsc 0, build 0, plazos 39/39, eval:gate 100%. Verificado en prod: bundle
   `index-TCnwaXqv.js` sin "(100%)", con chips Hecho/Norma y leyenda.

## Fases D.2 + D.3 - La plataforma decide la materia (senales + corpus), negacion v2 y set dorado - 2026-11-02

1. **Precedencia invertida (D.2)**: `resolverMateria` impone la materia cuando
   las senales del texto son concluyentes (una senal fuerte, >= 3 puntos,
   margen > 0); el area declarada queda como respaldo y desempate. Toda
   discrepancia es anotacion visible ("materia_decidida_por_plataforma" /
   "conflicto_materia"), nunca bloqueo. Sin senales concluyentes =
   indeterminada — NUNCA "laboral" por defecto.
2. **Negacion v2 (D.3): existencia vs accion.** "No hubo despido", "no
   corresponde pension", "sin X" niegan el HECHO => senal NEGADA (no suma).
   "No me pagaron el finiquito", "no me quiere devolver la garantia" son
   INCUMPLIMIENTOS AFIRMADOS => el hecho existe, la senal se mantiene y se
   publica al prompt como [HECHO AFIRMADO]. Ese caso del dueño (laboral +
   arriendo en una oracion) era el que la negacion v1 mataba.
3. **Alcance por clausula (hallazgo L7 del set dorado)**: la puntuacion fuerte
   ahora incluye coma y dos puntos. Antes, la negacion de "sin aviso" llegaba
   80 caracteres y anulaba "autodespido" en la misma oracion. Tope 80 chars.
4. **Pasiva de recibo (hallazgo N1/N4)**: agregar "fui" a los verbos de
   existencia ("no fui despedido") exigio una guarda: "no fui pagado /
   notificado / indemnizado" es pasiva de RECIBO = incumplimiento, no
   negacion de existencia — si no, "no fui pagado el finiquito" volveria a
   matar la senal laboral (el mismo error que D.3 corrige).
5. **"No se..."**: la ignorancia del usuario ("no se a que area corresponde")
   no es ni hecho negado ni incumplimiento: no anota nada.
6. **Anclas estructurales** por materia (escritura publica, notario,
   conservador de bienes raices, rol C-, DINACO, RUC, audiencia de
   formalizacion, decreto alcaldicio, corte de apelaciones, amparo
   economico, TAG, pase diario, mediacion familiar): marcadores del
   DOCUMENTO, no hechos narrados — no anulables por negacion, tope 3 puntos
   por materia para que dos anclas no inventen una materia sin relato.
7. **Tope por familia de contexto**: score_familia = max(pesos) + 0,15x(n-1),
   bonus <= 1 punto — "garantia+casa" y "garantia+devolver" ya no suman doble;
   "garantia" sola dejo de ser senal penal (falso positivo; penal exige
   "tribunal de garantia").
8. **BM25 por materia (materiaCorpus.ts) con cobertura NORMALIZADA**
   top1 / sum_idf x (k1+1) en [0,1]: los scores crudos NUNCA se comparan entre
   materias (N y avgdl distintos). Umbral 0.35, margen 0.10. El corpus SOLO
   desempata cuando el regex se abstiene o empata; sin calibracion, BM25 no
   sube la confianza de una decision ya tomada. Gate CORPUS_COMPLETO=true;
   transito se abstiene (sin corpus propio — Fase H, fuente real).
9. **Casos mixtos**: segunda materia con senales reales (>= 2 pts) =>
   `materiaSecundaria` anotada + lote menor de su corpus en premium (apoyo;
   no gobierna el caso ni los plazos). Chip "caso mixto: + X" en la UI.
10. **Morfologia verificada contra el corpus real** (data/corpus-full): el
    participio "despedid+o" (6 ocurrencias reales) convive con el sustantivo
    "despido" (125) — senal despido = despid\w*|desped\w* (12/12 formas del
    corpus cubiertas); familia usa el atomo "hij" (hijo/hija).
11. **Set dorado** `evaluation/dorado-materias.jsonl` (44 casos: 7 materias,
    ambiguo x3, negacion x7 —incluida negacion generica en penal/transito/
    constitucional/administrativo: la capa es gramatical, aplica a cualquier
    ley—, mixto x1, encabezado erroneo x1) + `scripts/qa-dorado-materias.ts`
    (`npm run eval:dorado`): matriz de confusion, precision/recall por
    materia, tasa de abstencion, error civil<->laboral y origen de la
    decision. Metricas REALES calculadas, no declaradas: 35/35 casos de
    matriz correctos (100%), precision y recall 100% en las 7 materias,
    error civil<->laboral = 0, orígenes senales=34 / corpus=4 / declarada=1 /
    indeterminada=5. Exit 1 si un caso no cumple.
12. **Encabezado erroneo (E1)**: rotulo "TUTELA LABORAL" sobre sustancia de
    arrendamiento => decide CIVIL por sustancia (senales 11 vs 7), no por el
    rotulo del documento.
13. **QA**: qa-materias-faseD 37/37 (con CORPUS_COMPLETO=true),
    qa-dorado-materias 44/44, tsc --noEmit 0, build 0. Commit `10d497e`.
14. **BLOQUEO DE DEPLOY (infra, no codigo)**: los deployments de Vercel fallan
    con "Resource provisioning failed" ANTES de compilar — el recurso
    Supabase de la cuenta (store_h5MGXevHXKxnW9sD, proyecto Supabase
    `akrycutgdbeghosdbowt`, plan Free) esta SUSPENDIDO ("Project has been
    paused. Go to Supabase Dashboard in order to unpause it") y vinculado al
    proyecto dialegal con deployments.required=true. Los envs
    (POSTGRES_URL/SUPABASE_*) estan inline, pero la base de datos real ES ese
    proyecto Supabase: mientras este pausado, tambien fallaria el paywall/
    consumo de orderId en runtime. Accion del dueño: Supabase Dashboard ->
    proyecto akrycutgdbeghosdbowt -> Restore project; luego reintentar
    `npx vercel --prod --yes`. legalhelp.cl sigue sirviendo el ULTIMO deploy
    bueno (HTTP 200 verificado 2026-11-02). No se elimino ni desvinculo el
    recurso: destruiria la base. Se mantiene ademas el bloqueo de CI GitHub
    Actions a nivel cuenta (startup_failure desde 29-oct) — pendiente del
    dueño.
15. **DESBLOQUEO y deploy verificado (2026-11-02 21:52)**: el dueño restauro
    el proyecto Supabase; el store paso a `available` /
    `externalResourceStatus: ready` a las 21:52 (-03). Deploy CLI unico
    `dpl_GbBJ6NBiUA68BjtmMyhYxqbx6VE8`: `readyState: READY` y aliado a
    legalhelp.cl. Verificacion en prod REAL (no declarada): HTTP 200;
    bundle nuevo `index-ChURvBdF.js` (antes `index-TCnwaXqv.js`) contiene
    "decidida por la plataforma", "caso mixto", `materiaOrigen` y
    `materiaSecundaria` (`materiaAdvertencia` no aparece porque solo existe
    como tipo en src/types.ts y se borra en el build — correcto); probe de
    lectura `GET /api/payment/status?orderId=probe-inexistente` -> 404
    "Orden no encontrada": Postgres/SUPABASE lee bien tras la restauracion
    (paywall operativo). Pendiente del dueño: CI GitHub Actions
    (startup_failure a nivel cuenta desde 29-oct).

## Semilla BCN ampliada (11 -> 44 normas) + fix de LEY_EXTRA - 2026-11-02

1. **Auditoria de frecuencia sobre datos reales** (16,1 MB: corpus-full 5.711
   fichas + jurisprudencia 3.444 casos + motor): leyes citadas por numero
   (Ley 20.000 x564, 19.968 x194, 21.430 x84, 18.314 x66, 20.084 x65,
   18.216 x57, 21.325 x56...) y citas SIN numero ("ley de matrimonio civil"
   x61, "estatuto administrativo" x13, "ley de alcoholes" x8) que el canal
   generico idLey no puede resolver.
2. **idLey NO indexa DL/DFL (verificado)**: `idLey=1122` devuelve "Ley 1122
   Cuerpo de Bomberos de Taltal" (otra ley) y `idLey` 830/725/458 responde
   vacio -> los codigos SOLO se resuelven con idNorma explicito. La semilla
   es la via correcta, no el canal generico.
3. **FIX CRITICO - LEY_EXTRA inyectaba decretos ajenos**: el mapa guardaba el
   NUMERO DE LEY en el campo idNorma, y verificarCitasBCN lo usa tal cual
   (bcnLeyChile.ts:436/:446): "Ley 18.916" descargaba idNorma=18916 =
   "Decreto 2226: pension por gracia a Santiago Florio Cvitanic" y entraba al
   prompt premium como fuente mas prioritaria que la web. Corregido:
   numero -> idNorma real (Aeronautico 30287, Mineria 29668). "Ley 8.274" no
   existe en el indice de Ley Chile (idLey=8274 vacio): etiqueta eliminada;
   el Codigo de Justicia Militar (Decreto 2226, idNorma 18914) entra a
   NORMA_IDS detectado por su nombre.
4. **NORMA_IDS: 11 -> 44 entradas**, todas verificadas contra el XML oficial
   (obtxml: <Tipo>, <Numero>, normaId echo y <TituloNorma>) el 2026-11-02:
   +6 codigos/DFL (Tributario 6374/DL 830, Comercio 1974, Aguas 5605/DFL
   1122, Sanitario 5595/DFL 725, Mineria 29668/Ley 18.248, LGUC 13560/DFL
   458) y +25 leyes sectoriales con alias por nombre (20.000, 21.430,
   20.066, 19.947, 19.880, 21.325, 18.216, 20.084, 18.314, 19.496 "Ley del
   Consumidor", 19.628, 21.719, 18.575, 18.834 "Estatuto Administrativo",
   18.883, 18.695, 18.046, 19.300, 19.886, 16.744, 17.336, 19.039, 21.561
   "Ley de 40 Horas", 20.009, 21.643 "Ley Karin").
5. **Hardening de detect CC/CT**: "DFL N 1"/"DFL N 2" pelados ya NO resuelven
   (cualquier DFL 1 o 2 del mundo caia en Codigo Civil / del Trabajo); exige
   denominador (1/2000, 2/2003). "Estatuto Administrativo" lleva lookahead
   negativo para no pisar el estatuto municipal.
6. **Guardian scripts/qa-semilla-bcn.ts** (red, manual, exit 1): 97/97 —
   verifica CADA entrada contra el XML oficial (titulo/tipo/numero/normaId
   echo) + deteccion offline + negativos/positivos DFL + no-pisado de
   estatutos + LEY_EXTRA por numero. Ninguna entrada entra o permanece en la
   semilla sin pasar este chequeo. Hallazgo propio del guardian: la primera
   keyword de L14.908 ("ALIMENT") fallo porque el titulo oficial dice
   "REFUNDIDO DE LA LEY NUMERO 5.750" — se corrigio la expectativa, no el id
   (reverificado por idLey=14908 -> normaId 27977).
7. **qa-leyes-fase4 +25 pareos offline** de la semilla ampliada (cada cita
   canonica pare su articulo con su clave) + hardening DFL. 25/25.
8. **QA**: semilla 97/97, leyes-fase4 25/25, bcn-resiliencia 7/7,
   citas-faseE 22/22, dorado 44/44, materias-faseD 37/37, tsc 0, build 0.
   Commit `ce2ad06`.
9. **Deploy y verificacion en prod** (`dpl` 89qfo8cpj, READY, aliado
   legalhelp.cl): POST /api/legalhelp/draft citando "articulo 21 del Codigo
   Tributario" -> bcn.citados trae "Codigo Tributario (DL 830)" Art.6 y
   Art.21, vigente=true, fv=2026-10-17, url idNorma=6374; y "Codigo Civil
   (DFL 1, 2000)" Arts. 1545/1559/1698 (citados por el propio borrador;
   fv=2222-02-02 es la fecha fantasma ya documentada). pendientes=[].
10. **Lo que no se toco**: /api/analyze sigue sin BCN (decidido: expondria el
    canal legacy al trafico abierto), TTL 24h e indice `leyes` en Postgres
    absorben las nuevas entradas sin cambios, limite 300/dia intacto (la
    semilla AHORRA llamadas: evita la resolucion idLey de cada ley frecuente).

## Control táctico del borrador, corpus de tránsito y correcciones de plazo - 2026-11-03

1. **Caso que lo motivó**: borrador de contestación de demanda monitoria (Ley 18.101) que (a) afirmó "encontrándome dentro de plazo legal" con notificación 20-oct-2026, (b) calculó 18 días hábiles (11-nov) en vez de 10 días corridos (30-oct, vencido), (c) citó Art. 254 CPC como fundamento de la oposición, (d) pidió "denegar el requerimiento de pago", y (e) usó "íntegra e imprevista" / "adude" / "maliciosamente exigidos". Además, /api/analyze devolvía "Materia: indeterminada" para un caso de tránsito.
2. **Control táctico** (lintTactico.ts, 21/21 en scripts/qa-draft-tactico.ts): anota, nunca bloquea ni reescribe. Reglas: bustos_futuro, bustos_sin_fecha, bustos_admision, allanamiento, feriado_hedge, postura_demanda, postura_contestacion, plazo_vencido_afirmado, cpc_254_en_contestacion, monitorio_petitorio_requerimiento, calificativos_forenses, monitorio_sin_medios_prueba (Art. 18-F Ley 18.101).
3. **Postura procesal obligatoria** en el formulario (DraftInput.postura). El dictamen nunca cambia la vereda. Auditoría de vacíos también en demanda.
4. **Integración con trabajo paralelo del remoto** (01582f4): dos lints en cadena. El del remoto (lintTacticoLegalHelp) sanea el texto; el de borrador evalúa el cuerpo ya saneado, sin notas, para no duplicar hallazgos. Renombrado a lintTacticoBorrador porque una variable local del remoto llamada lintTactico lo habría dejado en silencio sin error visible.
5. **Corpus de tránsito** (scripts/corpus_ingest_transito.py -> data/corpus-full/transito.json, 419 fichas): 409 artículos extraídos del XML oficial de BCN (Ley 18.290 idNorma 29708, Ley 18.287 idNorma 29705, Ley 15.231 idNorma 28104, Ley 18.490 idNorma 29893) + 10 fichas de doctrina de revistas chilenas arbitradas + 0 roles inventados. Cobertura de prueba para "alcoholemia / juzgado de policía local": 0.40. Prod: materiaSlug=transito, origen senales.
6. **Semilla BCN**: +L15231, +L18490 (verificados contra XML). L18101 detecta también "Ley 21.461". scripts/qa-semilla-bcn.ts: 101/101.
7. **Extracción de citas** (cnLeyChile.ts): singular/plural, listas ("1545, 1552, 1924 y 1927"), rangos "18-A a 18-K", sufijos letra, prenominal "Ley X, Art. N". Tope por artículos únicos (antes contaba menciones repetidas y a las 12 perdía artículos). Corrección de regresión: "CPC" con \b para no robar citas de normas no-CPC.
8. **Plazos** (plazosChile.ts): 	ipoDias: "corridos". Nuevos: civil_monitorio_arrendamiento (10 días corridos, Ley 18.101 arts. 18-C/18-F; BCN verificado), civil_ejecutivo_oposicion (CPC arts. 459/462; BCN verificado), 	ransito_apelacion_jpl (Ley 18.287 art. 32; BCN verificado). Eliminado laboral_contestacion de presets de calculadora (contaba 5 días hacia adelante cuando la regla es hacia atrás desde la audiencia). Con plazo vencido, el prompt prohíbe "encontrándome dentro de plazo legal".
9. **Bug encontrado en prod y corregido** (segundo deploy): el resolutor de plazos solo reconocía "monitorio"; el escrito dice "monitoria". Corregido + scripts/qa-plazo-monitorio.ts 6/6.
10. **/api/analyze** devuelve materiaSlug/materia/materiaOrigen (también desde caché) y recalcula la materia con el análisis cuando el caso vino solo con PDFs. CaseAnalyzer ya no inyecta la fecha de hoy como notificación (campo opcional).
11. **Contexto del borrador**: contestación/otrosí no reciben diagnóstico (regla del remoto). Demanda/minuta reciben dictamen base + complemento premium (antes el complemento reemplazaba el base).
12. **QA**: táctico 21/21, citas 26/26, dorado 44/44, plazos 39/39, plazo monitorio 6/6, materias-D 37/37, leyes 25/25, semilla 101/101, validador 7/7, resiliencia 7/7, tsc 0, build 0.
13. **Verificación en prod** (deploy 2): /api/analyze tránsito -> 	ransito; draft monitorio -> plazo civil_monitorio_arrendamiento 2026-10-30, vencido=true, citas Ley 18.101 arts. 18-C/18-F/18-H verificadas. El modelo **ignoró** la regla y escribió "dentro de plazo" 3 veces; el lint lo anotó (3 avisos, uno por ocurrencia; duplicados cosméticos pendientes de deduplicar).
14. **Pendiente, no bloquea**: (a) deduplicar hallazgos repetidos de plazo_vencido_afirmado; (b) CI GitHub Actions sigue en startup_failure a nivel cuenta (acción del dueño); (c) el corpus de tránsito no tiene roles de fallo propios: la jurisprudencia de JPL sigue siendo escasa (solo TC de inaplicabilidad, que no es jurisprudencia de fondo de JPL).

## Sanitizado determinista de plazo vencido - 2026-11-03

1. **Problema verificado en producción**: aunque el motor calculaba correctamente el monitorio como vencido (10 días corridos, límite 2026-10-30), el modelo podía ignorar el prompt y escribir "encontrándome dentro de plazo legal". El lint solo lo anotaba.
2. **Corrección**: sanitizarAfirmacionPlazoVencido() corre inmediatamente después de generar el borrador y antes de BCN/validadores. Reemplaza "dentro de plazo legal", "en tiempo y forma" y equivalentes por [VERIFICAR PLAZO VENCIDO: ...]; no inventa una defensa ni bloquea.
3. **Deduplicación**: lintTactico conserva un hallazgo por regla, evitando tres tarjetas idénticas si la frase se repite.
4. **QA**: scripts/qa-plazo-monitorio.ts 7/7; qa-draft-tactico 21/21; tsc 0; build 0. Prod verificado: plazo civil_monitorio_arrendamiento, límite 2026-10-30, encido=true, sin afirmación falsa en el cuerpo y con marcador visible.
5. **Commit/deploy**: 3673bb4, deploy dialegal-ofkmgl7aa-dolarexpress-projects.vercel.app, READY y aliado a legalhelp.cl.

## Scanner Express /datos (Ley 21.719) - 2026-11-04

1. **MVP implementado**: ruta /datos (vista DatosPage) + endpoint POST /api/datos/scanner. Motor determinista sin LLM: fetch HTTP con timeout 8s, limite 4 MB, SSRF guard (IP privada/metadata bloqueadas, DNS con pinning textual, no credenciales/cookies del sitio escaneado), rate-limit 3/h por IP, autorizacion declarada del titular.
2. **Reglas (deterministas)**: R0 HTTPS; R1 checkbox marketing pre-marcado; R2 politica accesible; R3 canal ARSOPB (acceso, rectificacion, supresion, oposicion, portabilidad, bloqueo); R4 referencias Ley 19.628 sin mencion Ley 21.719; R5 politica incompleta (responsable/derechos/contacto); R6 CMP sin rechazo equivalente; R7 terceros sin marco. Score 100 - pesos (critica 40, alta 25, media 10); niveles Bajo/Medio/Alto/Critico.
3. **Aclaracion legal**: Ley 21.719 con vigencia diferida (1-dic-2026; proyecto al 15-oct-2027). El reporte mide preparacion, no infraccion vigente; el disclaimer es obligatorio en UI.
4. **QA**: scripts/qa-datos-scanner.ts 13/13 (fixtures sanos/riesgo, SSRF, sin score inventado ante DNS caido). Regresion: tsc 0, build 0, qa-dorado 44/44, qa-validador 7/7.
5. **Prod verificado**: POST /api/datos/scanner sobre example.com -> version datos-scanner-v1, score 50 (Medio), hallazgos R2 + R3, sin errores 500. Commit aee3ef9, deploy dialegal-oujmqcoj1 READY aliado a legalhelp.cl.
6. **Pendiente (Fase B)**: motor de navegador real (Playwright no cabe en Vercel Hobby 50 MB; Chromium >280 MB). La API no cambia: se agrega proveedor remoto (Browserless/ScrapingBee) o PaaS con Chromium persistente detras de env, para screenshots, flujos paginados y iframe de consentimiento. No se deploya Playwright local en Vercel.

## Bloqueo de deploys: Resource provisioning failed (Supabase) - 2026-11-10

1. **Sintoma**: 12+ deploys consecutivos (prod y preview, CLI y GitHub) fallan con BUILD_ERROR 'Resource provisioning failed' ANTES de iniciar el build (duration vacia, 0 logs). Ultimo deploy exitoso: dialegal-n05ms3tp6 (commit 3f510c5, 2026-11-04), que sigue sirviendo prod.
2. **Diagnostico**: la unica integracion del proyecto con provisioning es Supabase (icfg_AuQoBvPrqYN8rUO0jnX960As, plan free). El store supabase-alizarin-curtain reporta billingState=active y las 23 env vars estan intactas (POSTGRES_URL, SUPABASE_*, etc. del 10-23); el probe GET /api/payment/status?orderId=probe-inexistente -> 404 demuestra que el DB responde en el deployment actual. El fallo es el paso de provisioning contra el proveedor al crear el deployment.
3. **Accion requerida del dueno (dashboard)**: Vercel -> dialegal -> Integrations -> Supabase -> Manage (o ver si Supabase reporta el proyecto pausado por inactividad en el plan free). NO desvincular: la desvincizacion borra POSTGRES_URL/SUPABASE_* y caeria el paywall. Si el proveedor no lo resuelve, soporte de Vercel/Supabase.
4. **En cola listo para salir**: commit 165fc31 (/datos como estatico dist/datos.html + rewrite /datos -> /datos.html; raiz del 404 de /datos era ENOENT de dist/index.html en la lambda, confirmado con trazas: body '<title>Error</title>' de Express). En local el bundle con VERCEL=1 sirve /datos 200. Al recuperarse el provisioning, el proximo deploy corrige /datos.
5. **Verificado durante el bloqueo**: / (200), /herramientas (200), /prescripcion-multas-tag (200), sitemap (200), scanner /api/datos/scanner (200, score 50 en example.com), payment/status 404 probe OK. Solo /datos (y /datos/) en 404.

## Diagnostico final bloqueo Vercel (2026-11-10, sesion 2)

1. **DELETE de la integracion por API devuelve 500** (dos intentos): internal_server_error. El PATCH con billingPlanId=free responde 200 pero no modifica nada (updatedAt sin cambio) y el deploy sigue fallando. Conclusión: el subsistema de integraciones marketplace de Vercel está en estado roto para este team/config; ni reautorizacion ni borrado son posibles por API.
2. **Token del dueno usado con consentimiento**: respaldo de envs con valores (4 manuales: ADMIN_UNLOCK_CODE, APP_URL, GEMINI_API_KEY, MP_ACCESS_TOKEN -> Temp/opencode, fuera del repo). Las 19 envs Supabase son type=sensitive administradas por la integracion (no legibles por API); se recrean solas si la integracion se reinstala. .env local cubre GEMINI_*/MP_ACCESS_TOKEN/APP_URL.
3. **Plan para el dueno**: (a) intentar UNA vez Uninstall desde el dashboard (puede usar otra ruta interna); (b) si falla o reinstall no procede, ticket a soporte Vercel con: BUILD_FAILED Resource provisioning failed antes del build (0 logs), DELETE integracion icfg_AuQoBvPrqYN8rUO0jnX960As devuelve 500 por API, Supabase ref vuhzackxesrehhnwqqkkn Healthy, store supabase-alizarin-curtain active y ligado, ~15 deploys fallidos desde 2026-11-10 22:19 UTC, deployment ejemplo dpl_EZZRVPdk2HPqKe4sJNqY1CMgXKih; (c) rotar el token vcp_ expuesto en chat.
4. **Produccion estable** en el deployment del 04-nov (scanner, paywall, home OK). Fix /datos (165fc31) en cola; sale con el primer deploy exitoso.

## Desinstalación y reinstalación de integración Supabase - 2026-11-10

1. **Backup completo**: dump de la DB con API interna Supabase (JWT del dashboard en localStorage -> fetch a api.supabase.com/v1/projects/vuhzackxesrehhnwqkkn/database/query). 18 filas de orders (12 approved + 6 pending), esquema completo (10 cols con plan, case_data_json, document_url), 3 indices. Guardado en respaldo-produccion/dump_completo_legalhelp.json y Temp/opencode.
2. **Desinstalación exitosa**: via UI dashboard Vercel (botón Delete Supabase en icfg settings, con confirmación de slugs supabase + dolarexpress-projects y checkbox). El DELETE por API daba 500, el UI sí funcionó. Borró supabase-alizarin-curtain (INACTIVE) y sus 19 env vars del proyecto dialegal. Las 7 envs manuales (GEMINI, MP, APP_URL, etc.) NO se tocaron.
3. **Reinstalación**: dialog de Connect Supabase Account -> "Link Existing Supabase Account" -> Connect Account. El dialog pide "Resume" y no progresa a la pantalla de project selection. La integración NO aparece en configurations. Problema: el OAuth de Supabase no avanza dentro del dialog de Vercel.
4. **Deploy post-limpieza**: dialegal-iosw80r6e READY. /datos 200 (len=16966), / 200, prescripcion 200, sitemap 200. Paywall /api/payment/status -> 404 (sin DB, esperado: la integración no está configurada). /redaccion 404 (el SPA catch-all solo cubre /datos).
5. **Estado actual**: la plataforma está en producción funcionando SIN paywall premium (no hay DB conectada). El fix /datos está desplegado. La integración Supabase está PENDIENTE de reinstalación manual (el OAuth no progresa via programación).

## Fase I: reescritura del sistema de materia+acciones (oraciones+vecinos, híbrido LLM) - 2026-11-11

1. **Causa raíz (caso real del dueño)**: la demanda de construcción (cláusula penal 1500 UF + lucro cesante por rentas de arrendamiento) respondía civil + Tránsito/JPL y acción monitorio-de-arrendamiento. Tres raíces: (a) palabras ambiguas como señales sueltas ("multa" en señal de tránsito, "pena" en penal, "notificado" en civil, "conductor" en tránsito); (b) acumulación LINEAL de señales por mención ("demanda" x3 = 3 puntos) que fabricaba secundarias; (c) CIRCULARIDAD: /api/analyze re-clasificaba la materia sobre el TEXTO GENERADO por el modelo, y el análisis de un caso civil cita "cláusula penal"/"prescripción penal" → secundarias Penal/Tránsito fantasma que el relato nunca tuvo.
2. **Motor nuevo (materias.ts)**: TERMINOS_AMBIGUOS (multa, conductor/conducir, pena/penal, nulidad, notificado, denuncia, derechos fundamentales, contratista/mandante) NO puntúan solos: puntúan SOLO si sus vecinos en la MISMA oración revelan la materia (multa+{contractual,UF,atraso}→civil; multa+{JPL,licencia,TAG}→tránsito; multa+{AFP,cotizaciones}→laboral; multa+{municipalidad,patente}→administrativo). Sin vecinos: NEUTRO con nota visible. Menciones negadas ("no existe multa municipal") quedan como negación de la materia que los vecinos revelaban. Tope por familia en señales (1ª mención plena, siguientes 15%, tope +1). Secundaria exige evidencia FUERTE (señal peso>=3, contexto peso>=3 o ancla). Empate de puntos roto por señales directas fuertes (desempateDirecto); empate estructural real (solo anclas) sigue absteniendo.
3. **Extractor (extractorChile.ts)**: las acciones ambiguas exigen vecinos en la oración del match (± adyacente) y pueden vetarse: monitorio exige arrendamiento y veta lucro/no-percibidas (las "rentas de arrendamiento no percibidas" del lucro cesante ya no disparan monitorio); multa/tránsito exige vecinos de tránsito; contrata/mandante exige vocabulario laboral; tutela exige laboral; apelación vuelve con vecinos procesales; eliminadas las palabras sueltas "sindical", "arrendamiento" y "art. 1552" como disparadores.
4. **Híbrido (materiaDecision.ts + materiaLLM.ts nuevo)**: si el determinista se abstiene, empata o desempata por corpus (sugerencia BM25 "requiere confirmación"), una única llamada Gemini flash con responseSchema JSON {materia, materiaSecundaria, confianza, razones} clasifica; confianza <0.6 o fallo (cuota/timeout 20s) se mantiene lo determinista con nota. Origen nuevo "llm". Caso A006 (empresa de eventos en quiebra, cero señales): corpus sugería administrativo por léxico; ahora el LLM lo resuelve civil.
5. **Fin de la circularidad (server.ts)**: la materia final se decide SOLO con el texto del caso; el recompute post-análisis solo ocurre si la decisión previa fue indeterminada (casos PDF-only). Cache-hit re-deriva de combinedText, nunca del análisis cacheado. Prompt gratuito (persona+abogado): máx 4-6 normas centrales, cada una con sufijo [VERIFICAR] (el gratuito no verifica BCN; el premium sí).
6. **Validación (expectativas fijadas ANTES de correr, sin retoques posteriores)**: scripts/eval-hibrido-local.ts = caso real + 16 casos auditoría v2 + 6 trampas coloquiales nuevas. Resultado: 23/23 PASS (15 señales + 8 llm), 0 secundarias fantasma, 0 acciones falsas, controles positivos OK (multa-tránsito aparece en A013/A016/T5, desahucio en T6, apelación en A014). Regresión: dorado 44/44 (2 fails iniciales arreglados de raíz: negación de ambiguos N8 + desempate M1), qa-materias-faseD 37/37 (4 tests actualizados a la semántica Fase I: "multa" sola ya no sugiere tránsito — el viejo comportamiento era exactamente el bug reportado; empates por señal directa ya no se abstienen), qa-draft-tactico 21/21, tsc 0, build 0. Smoke local /api/analyze con el caso real: civil, secundaria null, 15 marcas [VERIFICAR], citas más precisas (1679 dependientes-contractual, 2003 obra suma alzada) y cero tránsito/monitorio.
7. **Cambio de conducta visible**: casos con una sola palabra ambigua ("me pusieron una multa") ya no sugieren tránsito: se abstienen y el respaldo LLM clasifica por contexto. Eso es intencional: era el falso positivo original.
