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
