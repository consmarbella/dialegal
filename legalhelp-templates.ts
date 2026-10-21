// Plantillas por tipo de escrito para LegalHelp IA
// Cada plantilla define la estructura judicial obligatoria y guías de redacción

export const PLANTILLAS_TIPO: Record<string, string> = {
  demanda: `
ESTRUCTURA OBLIGATORIA PARA DEMANDA:
- Encabezado: S.J.L. [TRIBUNAL] / RIT [ROL] / CARÁTULA (demandante vs demandado)
- EN LO PRINCIPAL: [TIPO DE DEMANDA - ej: DEMANDA DE DESPIDO INJUSTIFICADO, NULIDAD Y TUTELA]
- ANTECEDENTES DE HECHO (numerados: PRIMERO:, SEGUNDO:, TERCERO:...)
- FUNDAMENTOS DE DERECHO (artículos, jurisprudencia, doctrina por institución)
- PETITORIO (numerado, claro, medible: 1) Declarar..., 2) Condenar..., 3) Costas)
- OTROSIES (notificaciones art. 44 CPC, pruebas, medida cautelar si procede)

REGLAS DE REDACCIÓN:
- Lenguaje forense chileno formal (usted, su, vuestra señoría)
- Hechos en pasado, pretensiones en futuro
- Cada artículo citado con su numeral exacto
- Jurisprudencia: "Fallo rector CS Rol N° X-YYYY" + síntesis de doctrina
- Montos en CLP con separador de miles (punto)
`,

  contestacion: `
ESTRUCTURA OBLIGATORIA PARA CONTESTACIÓN:
- Encabezado judicial completo
- EN LO PRINCIPAL: CONTESTACIÓN DE DEMANDA DE [TIPO]
- EXCEPCIONES PREVIAS (si caben: incompetencia, litispendencia, cosa juzgada, prescripción)
- NEGATIVA DE HECHOS (específica, por numerales: "Niegan el hecho 3°...", "Admiten el hecho 1°...")
- DEFENSAS DE FONDO (artículos, jurisprudencia, prueba documental)
- PETITORIO (rechazo total/parcial, absolución, costas)
- OTROSIES (notificaciones, pruebas, reconvención si procede)

REGLAS:
- Negativa taxativa por numerales (no genérica)
- Excepciones antes que fondo
- Reconocer hechos incontroversos
- Citar prueba documental anexada
`,

  otrosi: `
ESTRUCTURA OBLIGATORIA PARA OTROSÍ:
- Encabezado judicial
- OTROSÍ: [MATERIA - ej: "PRIMERO: NOTIFICACIÓN POR ESTADO DIARIO", "SEGUNDO: AMPLIACIÓN DE PRUEBA"]
- FUNDAMENTO LEGAL (artículo CPC/CPT aplicable: 44, 45, 254, 264, etc.)
- PETITORIO ESPECÍFICO Y CONCRETO
- FIRMA DEL ABOGADO

TIPOS COMUNES:
- Notificación (art. 44 CPC / 45 CPC)
- Ampliación/Ofrecimiento de prueba (art. 254, 256 CPC)
- Medida cautelar (art. 249 CPC)
- Acumulación/Incidente (art. 91, 473 CPC)
- Aclaración/Rectificación (art. 172 CPC)
`,

  minuta: `
ESTRUCTURA OBLIGATORIA PARA MINUTA DE AUDIENCIA:
- ENCABEZADO: MINUTA DE [AUDIENCIA PREPARATORIA / JUICIO / CONCILIACIÓN] - RIT [ROL]
- HECHOS RELEVANTES (síntesis cronológica)
- ARGUMENTOS ORALES ORDENADOS (por tema: competencia, hechos, derecho, prueba)
- PETICIONES CONCRETAS (qué se pide al tribunal en esta audiencia)
- CITAS JURISPRUDENCIALES CLAVE (rol + doctrina en 1 línea)

REGLAS:
- Formato esquemático, no narrativo
- Tiempo estimado por argumento
- Referencia a fojas del expediente
`,

  contrato: `
ESTRUCTURA OBLIGATORIA PARA CONTRATO:
- PARTES (identificación completa: nombre, RUT, domicilio, representación)
- ANTECEDENTES / RECITALES (contexto, voluntad)
- CLÁUSULAS:
  1. Objeto del contrato
  2. Obligaciones de las partes
  3. Plazo / Vigencia
  4. Precio / Contraprestación / Forma de pago
  5. Garantías / Cauciones
  6. Incumplimiento y resolución
  7. Jurisdicción y fuero
  8. Notificaciones
- FIRMAS (con testigos si requiere escritura pública)

REGLAS:
- Numeración correlativa de cláusulas
- Definiciones al inicio si son técnicas
- Ley aplicable chilena expresa
`,

  correo: `
ESTRUCTURA OBLIGATORIA PARA CORREO DE NOTIFICACIÓN/COMUNICACIÓN:
- ASUNTO: [TRIBUNAL] - [ROL] - [MATERIA] - [URGENTE si aplica]
- DESTINATARIO (juez/secretario/contralor) / CC (contraparte)
- REFERENCIA: Causa RIT [ROL], carátula [X vs Y]
- CUERPO FORMAL:
  * Saludo protocolar
  * Hechos/antecedentes breves
  * Solicitud concreta con fundamento legal
  * Plazo/respuesta solicitada
- FIRMA PROFESIONAL (nombre, RUT, domicilio profesional, teléfono, email)
- ANEXOS (listados)

REGLAS:
- Brevedad y claridad
- Un solo tema por correo
- Referencia a fojas si es escrito en causa
`,
};

export const ARTICULOS_CLAVE_POR_AREA: Record<string, string[]> = {
  laboral: ["159", "161", "162", "174", "201", "452", "485", "489", "Ley 21.643"],
  civil: ["1445", "1545", "1547", "1554", "1559", "2314", "2320", "1557"],
  familia: ["229", "230", "232", "233", "439", "440", "441", "14908"],
  penal: ["1", "2", "12", "13", "14", "15", "16", "17", "19.696"],
  administrativo: ["5", "6", "7", "8", "9", "10", "11", "12", "19.880"],
  constitucional: ["1", "2", "3", "4", "5", "19", "20", "21", "16"],
};

export function getPlantilla(tipo: string): string {
  return PLANTILLAS_TIPO[tipo] || PLANTILLAS_TIPO.demanda;
}

export function getArticulosClave(area: string): string[] {
  return ARTICULOS_CLAVE_POR_AREA[area] || ARTICULOS_CLAVE_POR_AREA.laboral;
}