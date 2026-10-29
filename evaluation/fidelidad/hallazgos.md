# Fase A — Auditoría de fidelidad: informe premium vs. fuente normativa (2026-10-29)

Caso disparador: demanda civil de indemnización de perjuicios por incendio (~$550.000.000),
notificación de la demanda el **jueves 29-10-2026**. El informe premium se generó en prod
(legalhelp.cl) el 29-10-2026 y el dueño pegó la respuesta completa en la conversación de ese día.

## 1. Procedencia y alcance

- `/api/premium-report` tiene paywall server-side (`orderId` + consumo atómico de usos,
  `server.ts:535`+): el informe **no es re-ejecutable** sin una orden pagada. La captura del
  dueño es el artefacto primario; su texto verbatim vive en la conversación del 29-10-2026.
  **No se reproduce aquí** para no parafrasear de memoria (honestidad estricta). Si se desea
  archivar, pegar el texto en `evaluation/fidelidad/informe-premium-2026-10-29.md` (pendiente
  de pegado del dueño; ídem el input exacto en `demanda-input.txt`).
- Método: cada regla se sentenció contra **XML oficial de Ley Chile descargado y decodificado
  el 2026-10-29** (canal `Consulta/obtxml?opt=7`), no de memoria y no contra el diagnóstico
  de Perplexity. Los XML quedaron en temp para re-verificación: `cpc22740.xml` (57.121.638 B,
  status 200 en 153 ms), `cot25563.xml` (899 KB).

## 2. Cadena normativa verificada — plazo de contestación civil

| Fuente | Texto oficial (verbatim) | Consecuencia |
|---|---|---|
| **CPC art. 258** (idNorma 22740; parte con `fechaVersion="2021-11-30"`) | "El término de emplazamiento para contestar la demanda será de **dieciocho días** si el demandado es notificado en el territorio jurisdiccional del tribunal en que se haya presentado la demanda." | Término base = **18 días**, sin la palabra "hábiles". |
| **Ley 21.394** art. 3° N°12 (idLey 21394, D.O. 30-11-2021) | "Modifícase el artículo 258 en el siguiente sentido: a) Reemplázanse, en el inciso primero, la palabra 'quince' por 'dieciocho', y la frase 'en la comuna donde funciona el tribunal' por 'en el territorio jurisdiccional del tribunal en que se haya presentado la demanda'. b) Suprímese el inciso segundo." | El 258 anterior decía "quince"; la cita del informe "modificado por la Ley 21.394" **es correcta**. |
| **Ley 21.394** art. 3° N°13 | "Reemplázase, en el inciso primero del artículo 259, la frase 'será de dieciocho días, y a más el aumento que corresponda' por 'se aumentará de conformidad'." | El art. 259 vigente quedó **solo** como tabla de aumento por distancia (CS, quinquenal). El término base vive íntegro en el 258. |
| **CPC art. 66** vigente (parte `fechaVersion="2014-09-04"`, según Ley 20.774 art. 2° N°2) | "Los términos de días que establece el presente Código, se entenderán suspendidos durante los feriados, salvo que el tribunal, por motivos justificados, haya dispuesto expresamente lo contrario." | Los plazos de días del CPC suspenden **solo durante los feriados**. |
| **Ley 2.977** art. 1° (idLey 2977, `fechaVersion="1927-06-25"`) | "…sólo se considerarán como feriados los dias siguientes; **1° Los Domingos de todo el año.** 2° Los festivos correspondientes al 1° de Enero, 29 de Junio, 15 de Agosto, 1° de Noviembre, 8 i 25 de Diciembre i las fiestas movibles de la Ascension del Señor i de Corpus Cristi… 3° Los Viérnes i Sábados de la Semana Santa. 4° El 18 de setiembre… 5° El 19 de Setiembre i el 21 de Mayo…" | **Domingos son feriados** (suspenden); **sábados NO lo son** (salvo Sábado Santo) → corren. 29-jun y 1-nov son feriados desde 1915. |
| **Ley 19.668** art. único (fv 2007-01-06) | "Trasládanse los feriados correspondientes al 29 de junio, día de San Pedro y San Pablo; 12 de octubre, día del descubrimiento de dos mundos; a los días lunes de la semana en que ocurren, en caso de corresponder a día martes, miércoles o jueves, o los días lunes de la semana siguiente, en caso de corresponder a día viernes." | Regla de traslado a lunes de 29-jun y 12-oct. |
| **Ley 20.299** arts. 1°-2° (idNorma 279294, fv 2008-10-11) | "Declárase feriado el día 31 de octubre…" / "Trasládase el feriado… al día viernes de la misma semana en caso de corresponder el 31 de octubre a día miércoles, y trasládase al día viernes de la semana inmediatamente anterior en caso de corresponder dicha fecha a día martes." | 31-oct es feriado (con traslado); **no derogó el 1-nov** (sigue feriado por la 2.977, nunca derogada). |
| **CPC arts. 259/260** vigentes | 259: aumento por distancia según tabla quinquenal de la CS. 260: pluridad de demandados (+1 día por cada 3 sobre 10, máx. 30). | Conforme a lo modelado. |
| **COT art. 313** (idNorma 25563, vigente 2026-04-02) | "Las obligaciones de residencia y asistencia diaria al despacho cesan durante los días feriados. Son tales **los que la ley determine** y los comprendidos en el tiempo de vacaciones de cada año…" | El "feriado judicial" es lo que determine la ley (2.977 y mods.) + el feriado anual variable por auto acordado (ya fuera del motor, cubierto por [VERIFICAR]). |

Búsquedas negativas verificadas sobre los XML decodificados (blindan la regla):
- CPC vigente: **0 menciones de "sábado"**, 0 de "quince días hábiles", 0 de "dieciocho días hábiles", 0 de "feriado judicial", 0 de "cierren los tribunales". "dieciocho" aparece solo en el art. 258 (y en edades de testigos).
- COT vigente: **0 menciones de "sábado"**. La regla de días/horas de funcionamiento judicial no define feriados propios más allá del art. 313.
- Ley 20.215 (2007): solo comercio (irrenunciabilidad navideña + trasitorio puntual 17-sep-2007). Ley 20.069 (2005): trabajo de menores. **Ninguna es regla de traslado de feriados** — descartadas.

**Regla civil resultante (correcta)**: 18 días que corren de **lunes a sábado**, suspendidos
domingos y feriados legales; art. 48 CC excluye el día inicial y prorroga si el último cae feriado.

**Caso del dueño**: notificación jueves 29-10-2026 → día 1 = vie 30-10; suspenden 31-oct (sábado
feriado evangélico, 2026 cae sábado y no se traslada) y 1-nov (domingo feriado); el 18° día es el
**viernes 20-11-2026**. Coincide con la calculadora de la UI y con el diagnóstico externo.
(Para 2026: 31-oct cae sábado → la regla de traslado de la 20.299 solo opera martes/miércoles, no aplica; 1-nov cae domingo → queda.)

## 3. Errores del informe premium confirmados

1. **Fecha límite inconsistente dentro del propio informe**: el dictamen dijo **19** (= 15 días
   hábiles lun-vie con la regla derogada: límite jue 19-11-2026) y el complemento dijo **21** —
   internamente contradictorios. Correcto: **viernes 20-11-2026** (18 días, sábados corren,
   31-oct y 1-nov suspenden).
2. **Materia equivocada**: título/diagnóstico con elementos de "tutela laboral" en un caso
   civil (ver § 5 — la causa raíz es del motor de jurisprudencia, no solo del LLM).
3. **Motor de plazos no interviene en premium** (ver § 4.3): las fechas del informe son
   estimación del LLM, exactamente lo que la Fase 7 eliminó del borrador gratuito.

## 4. Errores del motor (`plazosChile.ts`) confirmados

1. `civil_contestacion` usa **15 días** → correcto **18** (art. 258 según Ley 21.394).
2. `esDiaHabil` (líneas 65-73) excluye sábado (`dow === 6`) para **todas** las materias → en
   civil los sábados **corren** (art. 258 "días" a secas + art. 66 solo suspende feriados +
   Ley 2.977 no lista sábados). Laboral/familia quedan lun-vie (CT).
3. `FERIADOS_FIJOS` (líneas 12-17):
   - **Entradas espurias a eliminar**: `[24,12,"Feriado judicial"]` y `[31,12,"Feriado judicial"]`
     — el 24-dic es solo vespertino irrenunciable de comercio (CT art. 22) y el 31-dic no es
     feriado (verificado contra Ley 2.977 vigente y fuentes oficiales). Ninguna ley crea esos feriados.
   - **Faltan**: 29-jun (traslado lunes 19.668), 12-oct (traslado lunes 19.668),
     31-oct (traslado viernes 20.299 art. 2°), 1-nov.
4. Recalculos de expectativas con la regla nueva (conteo manual, validado contra qa #3):
   - qa #3 (notif lun 27-01-2025, 18 días): **2025-02-17 — sin cambio** (coincidencia: +3 días ≈ 3 sábados nuevos).
   - qa #10 (notif 03-02-2026, 3 días): **2026-02-06 — sin cambio**.
   - gate C1 (notif mié 27-01-2027, 18 días): **2027-02-17 — sin cambio** (mié 17-02-2027). *Nota: la
     nota preliminar de esta fase decía 16-02-2027; el conteo día a día (con domingos 31-01/07-02/14-02
     suspendidos y sábados corriendo) da el 17. Validar contra el motor en Fase B antes de editar `cases.jsonl`.*
   - Caso del dueño: **2026-11-20**.

## 5. Materia mixta — causa raíz verificada en código

- `jurisprudenciaChile.ts:329`: `getIndice().concat(getIndiceExtendido(slugArea))` — el corpus
  base (laboral) **siempre co-rankea** aunque el área declarada sea otra.
- Evidencia conductual en prod (`/api/juris-test`, query civil limpia, 2026-10-29): 8 resultados,
  incluyendo la ficha "Suministro de mano de obra" con `materia: "Laboral"` — esa ficha vive en
  `data/corpus-full/laboral.json`. El corpus por área civil carga bien en prod (aparecen fichas
  "Civil", "Presunciones Arts. 2320/2329 CC"), así que el problema es la **fusión**, no el flag
  `CORPUS_COMPLETO` (que sí existe en Production) ni la clasificación de los datos.
- Priming contradictorio del prompt: `server.ts:576-580` primea "MATERIA DETECTADA: Laboral"
  pese al área declarada civil; keywords en `server.ts:483`; `buscarCasosJurisMulti(consultas)`
  se llama **sin slug** en `server.ts:639`.

## 6. Otros hallazgos (Fases C-F)

- **Premium sin motor**: `grep plazosMotor|chequearPlazos|anotacionesPlazos` en `server.ts` = 0
  matches dentro de `/api/premium-report`. La Fase C lo conecta (anotación, nunca bloqueo).
- **Etiqueta de confianza falsa**: "DICTAMEN TÉCNICO COMPLETO (100%)" hardcodeada en
  `src/components/AnalysisReport.tsx:447` — reemplazar en Fase F.
- **CC `fechaVersion="2222-02-02"`**: verificado que el XML de Ley Chile trae ese placeholder
  upstream para el Código Civil (CC art. 1511 volvió así por el canal `verificarCitasBCN`).
  No es bug de parseo propio; sanitizar en el panel (Fase F).
- **Fragilidad BCN con normas enormes**: `verificarCitasBCN` falló 2/2 en local contra el CPC
  ("norma_no_disponible") mientras el fetch directo del mismo XML responde 200 en 153 ms con
  57 MB. En prod hay Postgres (Supabase integrado; `bcnLeyChile.ts:225` resuelve
  `DATABASE_URL || POSTGRES_URL`), pero el flujo local/sin-cache queda expuesto al tamaño del
  cuerpo. Revisar canal en Fase C o posterior.

## 7. Correcciones respecto del diagnóstico preliminar

1. **Ley 21.394 SÍ modificó el art. 258 CPC** (art. 3° N°12 y N°13). El diagnóstico preliminar
   concluyó lo contrario ("solo tocó el art. 41 por referencia cruzada") por un output truncado
   y un filtro case-sensitive del probe. La cita del informe es **correcta**; el test de
   verificación de citas de la Fase E debe **confirmarla**, no refutarla.
2. **El COT art. 6 no tiene nada que ver con días hábiles** (es jurisdicción extraterritorial);
   la regla relevante vive en COT 313 + CPC 66 + Ley 2.977. El idNorma canónico del COT es
   **25563** (resuelto aquí; el redirect de `/navegar` no lo expone y `idNorma=20676` es un
   decreto ajeno).
3. **Gate C1 = 17-02-2027** (no 16-02): conteo día a día; validar contra motor en Fase B.

## 8. Fuentes (XML oficiales, consultadas 2026-10-29)

- CPC: `obtxml?opt=7&idNorma=22740` (57 MB, vigente; partes 258 fv 2021-11-30, 259, 260, 66 fv 2014-09-04)
- Ley 21.394: `obtxml?opt=7&idLey=21394` (29 estructuras; arts. 3° N°12/N°13)
- Ley 2.977: `obtxml?opt=7&idLey=2977` (fv 1927-06-25, texto original; art. 1° completo)
- Ley 19.668: `obtxml?opt=7&idLey=19668` (art. único, traslados a lunes)
- Ley 20.299: `obtxml?opt=7&idLey=20299` / `idNorma=279294` (arts. 1°-2°, feriado evangélico)
- Ley 20.774: `obtxml?opt=7&idLey=20774` (fv 2014-09-04; arts. 1°-7°, fin del feriado judicial de febrero — ya aplicada en Fase 4)
- COT: `obtxml?opt=7&idNorma=25563` (900 KB, vigente 2026-04-02; arts. 3, 313, 343)
- Ley 20.215 / 20.069: descartadas como reglas de traslado (texto completo verificado)
- Evidencia conductual: `POST /api/juris-test` en prod con query civil limpia (captura en temp)
