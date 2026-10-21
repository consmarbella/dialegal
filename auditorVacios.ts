import type { DraftInput, VacioCritico } from './src/types';

/**
 * Auditoría determinista de vacíos críticos (Fase 2).
 * Sin LLM: reglas puras sobre el borrador generado + input.
 * Alcance MVP: solo contestación de demanda. Regla de oro:
 * no inventar datos ni dejar corchetes ciegos sin pregunta.
 */

const contextosTexto = (input: DraftInput): string =>
  [input.hechos, input.documentoCaso, input.dictamen, input.pretensiones.join(' '), input.rol, input.tribunal, input.respuestasAuditoria]
    .filter(Boolean)
    .join(' ');

/** Quita el contenido entre corchetes para detectar datos REALES (no placeholders). */
const sinCorchetes = (t: string): string => t.replace(/\[[^\]]*\]/g, ' ');

const contieneFecha = (t: string): boolean =>
  /\b\d{1,2}\s+de\s+[A-Za-zÁÉÍÓÚáéíóú]+\s+(?:de\s+)?\d{4}\b/.test(t) ||
  /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/.test(t);

export function auditarVacios(draft: string, input: DraftInput): VacioCritico[] {
  if (input.tipo !== 'contestacion') return [];

  const vacios: VacioCritico[] = [];
  const push = (campo: string, prioridad: 'fatal' | 'importante', pregunta: string, fragmento?: string) => {
    if (vacios.some(v => v.campo === campo)) return;
    vacios.push({ campo, prioridad, pregunta, fragmento: fragmento?.slice(0, 160) });
  };

  // Normaliza corchetes escapados en markdown (\[RIT DEL CASO\] → [RIT DEL CASO])
  const draftNorm = draft.replace(/\\([\[\]])/g, '$1');
  const draftLimpio = sinCorchetes(draftNorm);
  const contexto = contextosTexto(input);

  // 1. RIT de la causa (fatal). Solo cuenta el formato real de carátula (RIT/RUC
  //    con código de materia), NO roles de fallos jurisprudenciales citados (61.313-2024).
  const ritRealEnDraft = /\b(?:RUC|RIT)\b[\s:.,]*([CMIE]+)-?(\d{1,6})-(\d{2,4})\b/.test(draftNorm);
  const rolPropioEnInput = /\b(?:R[UI][CT])?\s*[:.]?\s*[CMIE]{1,4}-?\d{1,6}-\d{2,4}\b|\b\d{1,6}-\d{4}\b/.test(input.rol || '');
  if (!rolPropioEnInput && !ritRealEnDraft) {
    push('rit', 'fatal', 'RIT (rol interno) de la causa: escribe el rol exacto de la carátula del expediente, con formato como "RIT C-1234-2026". Lo encuentra en la OJV o en la carátula de la demanda notificada.');
  }

  // 2. Tribunal / S.J.L. (fatal)
  const tribunalRealEnDraft = /S\.?\s?J\.?\s?L\.|Juzgado de (Letras|Garant|Familia|Trabajo|Cobranza)/i.test(draftLimpio) || !!input.tribunal?.trim();
  if (!tribunalRealEnDraft) {
    push('tribunal', 'fatal', 'Tribunal ante el que se presenta la contestación (bloque S.J.L. del encabezado): nombre exacto, ej. "S.J.L. de Santiago" o "Juzgado de Letras y Garantía de Lautaro".');
  }

  // 3. Patrocinio y poder (fatal): un abogado siempre debe estar identificado.
  //    Se examina la sección del otrosí de PATROCINIO Y PODER del borrador.
  const seccionPatrocinio = (draftNorm.match(/PATROCINIO\s+Y\s+PODER([\s\S]{0,700})/) || [])[1] || '';
  const corcheteEnPatrocinio = /\[/.test(seccionPatrocinio);
  const nombreRealEnPatrocinio = /[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}/.test(sinCorchetes(seccionPatrocinio));
  if (corcheteEnPatrocinio || !nombreRealEnPatrocinio) {
    push('patrocinio', 'fatal', 'Datos del abogado patrocinante para el otrosí PATROCINIO Y PODER: nombre completo, N° de patente (o pasaporte) y cédula, domicilio procesal y contacto, como exige el art. 17 N° 1 y 26 del CPC.', corcheteEnPatrocinio ? seccionPatrocinio.split('[').slice(1, 2).map(t => `[${t.split(']')[0]}]`).join('') : undefined);
  }

  // 4. Plazo fatal: fecha de notificación / audiencia preparatoria (importante)
  const todoElTexto = draftNorm + ' ' + contexto;
  const tieneNotificacion = /notific(aci|ad[oa]|amiento)/i.test(todoElTexto) && contieneFecha(todoElTexto);
  const tieneAudiencia = /audiencia\s+preparatoria/i.test(todoElTexto) && contieneFecha(todoElTexto);
  if (!tieneNotificacion && !tieneAudiencia) {
    push('plazo', 'importante', 'Fecha en que se notificó la demanda (o plazo restante): indispensable para confirmar que la contestación entra dentro del plazo de 15 días hábiles del art. 405 CPC y para fijar el término probatorio.');
  }

  // 5. Individualización de partes (fatal si hay corchetes de nombre)
  const nombresEnCorchetes = /\[(?:NOMBRE|Nombre del (?:Actor|Demandante|Demandado|Abogado)|Datos de?l[ao]?|Identificaci[óó]n)[^\]]*\]/i.test(draftNorm);
  if (nombresEnCorchetes) {
    push('partes', 'fatal', 'Individualización completa de demandante y demandado: nombre completo, RUN/RUT y domicilio real. Escribe los datos reales que reemplazan cada corchete — este borrador no admite corchetes ciegos.', (draftNorm.match(/\[(?:NOMBRE|Nombre del (?:Actor|Demandante|Demandado|Abogado))[^\]]*\]/i) || [])[0]);
  }

  // 6. Testigos sin individualización (importante)
  if (/testigo/i.test(draftLimpio)) {
    const testigosIndividualizados = /testigo[^\n]{0,150}(?:RUN|R\.?U\.?N\.?|c[ée]dula|domicilio)/i.test(draftNorm);
    if (!testigosIndividualizados) {
      push('testigos', 'importante', 'Individualización de los testigos anunciados: nombre, RUN y domicilio de cada uno. Si aún no los tienes, deja constancia "los individualizados en el respectivo otrosí" y completa la lista antes de la audiencia.');
    }
  }

  // 7. Marcadores [DATO FALTANTE: X] restantes (fatal)
  let m: RegExpExecArray | null;
  const marcador = /\[DATO FALTANTE:\s*([^\]\n]{3,80})\]/gi;
  let i = 0;
  while ((m = marcador.exec(draftNorm)) !== null && i < 8) {
    i++;
    push(`faltante-${i}`, 'fatal', `Dato omitido en el borrador — "${m[1].trim()}": entrégalo para reemplazar el corchete antes de presentar.`, m[0]);
  }

  // 8. Corchetes genéricos restantes. Los operativos (RIT, RUC, abogado, cédulas)
  //    son fatales; el resto importante. Los [NOMBRE ...] ya los cubre la regla 5.
  const corchetesGenericos = draftNorm.match(/\[(?!\s*(?:DATO FALTANTE|VERIFICAR|NOMBRE|Nombre del (?:Actor|Demandante|Demandado|Abogado)))[^\]\n]{3,60}\]/g) || [];
  const corchetesUnicos: string[] = [];
  const yaVistos = new Set<string>();
  for (const c of corchetesGenericos) {
    const key = c.toUpperCase();
    if (yaVistos.has(key)) continue;
    yaVistos.add(key);
    corchetesUnicos.push(c);
  }
  if (corchetesUnicos.length) {
    const esCritico = corchetesUnicos.some(c => /rit|ruc|rol de la causa|comuna del tribunal|abogado|patente|c[eé]dula|rut\b|run\b|notifi/i.test(c));
    push(
      'corchete',
      esCritico ? 'fatal' : 'importante',
      `Corchetes ciegos en el escrito — ${corchetesUnicos.slice(0, 5).map(s => `"${s.slice(1, -1).trim()}"`).join(', ')}${corchetesUnicos.length > 5 ? ' y otros' : ''}: reemplázalos con los datos reales (cédula, fecha, N° de folio, correo o documento específico).`,
      corchetesUnicos[0]
    );
  }

  return vacios.sort((a, b) => (a.prioridad === 'fatal' ? -1 : 1) - (b.prioridad === 'fatal' ? -1 : 1));
}
