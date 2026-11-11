// Plantillas por tipo de escrito para LegalHelp IA
// Cada plantilla define la estructura judicial obligatoria y guías de redacción

export const PLANTILLAS_TIPO: Record<string, string> = {
  demanda: `
ESTRUCTURA OBLIGATORIA PARA DEMANDA:
- Encabezado: S.J.L. [TRIBUNAL] / RIT: por asignar / CARÁTULA (demandante vs demandado)
- EN LO PRINCIPAL: [TIPO DE DEMANDA - ej: DEMANDA DE DESPIDO INJUSTIFICADO, NULIDAD Y TUTELA]
- ANTECEDENTES DE HECHO (numerados: PRIMERO:, SEGUNDO:, TERCERO:...)
- FUNDAMENTOS DE DERECHO (artículos, jurisprudencia, doctrina por institución)
- PETITORIO (numerado, claro, medible: 1) Declarar..., 2) Condenar..., 3) Costas)
- OTROSIES (notificaciones art. 44 CPC, pruebas, medida cautelar si procede)

REGLAS DE REDACCIÓN:
- Voz EXCLUSIVA de la parte DEMANDANTE (prohibidas fórmulas de contestación: "mi representada se allana", "excepciones previas", "negativa de hechos", "defensas de fondo")
- Lenguaje forense chileno formal y sobrio (su Señoría, S.S.)
- Hechos en pasado, pretensiones en futuro
- Cada artículo citado con su numeral exacto
- Jurisprudencia: solo citar Rol si consta en las fuentes verificadas del caso
- Montos en CLP con separador de miles (punto)
`,

  contestacion: `
ESTRUCTURA OBLIGATORIA PARA CONTESTACIÓN U OPOSICIÓN:
- Encabezado judicial completo
- EN LO PRINCIPAL: CONTESTACIÓN DE DEMANDA (o en procedimiento monitorio de arrendamiento Ley 18.101: OPOSICIÓN FUNDADA A LA DEMANDA MONITORIA)
- EXCEPCIONES Y DEFENSAS (incompetencia, litispendencia, pago efectivo, contrato no cumplido art. 1552 CC, prescripción, etc.)
- NEGATIVA DE HECHOS (específica, por numerales: "En cuanto al Hecho PRIMERO...", "En cuanto al Hecho SEGUNDO...")
- FUNDAMENTOS DE DERECHO (Art. 309 CPC en ordinario; Arts. 18-F y 18-H Ley 18.101 en monitorio de arrendamiento; Arts. 459, 462 y 464 CPC en ejecutivo; jamás citar Art. 254 CPC como fundamento de una contestación u oposición)
- PETITORIO (coherente con lo reconocido: rechazo total o en todo lo que exceda el saldo expresamente reconocido, costas)
- OTROSÍES (acompaña documentos; en oposición monitoria Ley 18.101 art. 18-F: otrosí OBLIGATORIO anunciando todos los demás medios de prueba — testimonial, pericial, confesional, inspección personal — para el juicio declarativo posterior; patrocinio y poder Ley 18.120)

REGLAS:
- Voz EXCLUSIVA de la parte DEMANDADA
- Negativa taxativa por numerales (no genérica)
- PROHIBIDO prometer pagos o regularización futura en Ley Bustos ("procederá a regularizar/pagar", "con el objeto de convalidar") y PROHIBIDO allanarse "por si acaso" ("sumas que pudieren corresponder", "si existiere algún saldo")
- Si el PLAN DE PLAZOS marca PLAZO VENCIDO, prohibido escribir "encontrándome dentro de plazo legal" o "en tiempo y forma"
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
  laboral: ["159", "161", "162", "168", "452", "485", "489"],
  civil: ["1545", "1698"],
  familia: ["229", "230", "14908", "19.968"],
  penal: ["1", "11", "12", "14", "15"],
  administrativo: ["6", "7", "19.880"],
  constitucional: ["6", "7", "19", "20", "21"],
};

export function getPlantilla(tipo: string): string {
  return PLANTILLAS_TIPO[tipo] || PLANTILLAS_TIPO.demanda;
}

// Fase D: transito sin artículos clave modelados ([]) — la cobertura de normas
// de tránsito (Ley 18.290/18.287) corre por el canal BCN, no por esta lista.
// null (materia indeterminada) también devuelve []: NUNCA caer a laboral.
export function getArticulosClave(area: string | null | undefined): string[] {
  if (!area) return [];
  return ARTICULOS_CLAVE_POR_AREA[area] || [];
}