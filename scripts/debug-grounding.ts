// Debug aislado: ¿por qué 2.5-flash no ejecuta googleSearch?
// Payload de TAMAÑO REAL (dictamen ~11k chars) igual que /api/premium-report.
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI } from '@google/genai';

const envPath = path.resolve(process.cwd(), '.env');
const envTxt = fs.readFileSync(envPath, 'utf8');
const keys = (envTxt.match(/GEMINI_API_KEYS="?([^"\r\n]+)"?/)?.[1] || '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean);

const SYS = `Eres un auditor legal escéptico, especialista en Derecho Chileno, con más de 20 años de litigación en tribunales chilenos.
El usuario ha PAGADO. Recibirás el DICTAMEN JURÍDICO ya emitido por nuestro sistema para su caso. Tu tarea NO es reescribirlo ni repetirlo: es AÑADIR un complemento de verificación con búsqueda web que eleve la calidad del dictamen ya entregado.

Tienes acceso a Google Search. Realiza búsquedas y verifica el dictamen EXCLUSIVAMENTE contra fuentes OFICIALES chilenas:
bcn.cl (Biblioteca del Congreso Nacional / Leychile), pjud.cl (Poder Judicial), dt.gob.cl / dti.gob.cl (Dirección del Trabajo),
bcu.cl (Banco Central), mintrab.gob.cl, igm.cl, contraloria.cl, sernac.cl, diariooficial.interior.gob.cl,
y fallos o resoluciones oficiales publicadas por tribunales chilenos.

REGLAS ESTRICTAS:
1. Verifica los artículos, leyes y plazos CITADOS en el dictamen: confírmalos con la fuente oficial o marca "no verificado" si no aparecen en tus búsquedas. NO inventes números de artículos.
2. Aporta lo que el dictamen NO cubre: vicios de notificación, nulidades de todo género, plazos fatales fácilmente pasados por alto, requisitos formales estrictos y puntos ciegos que puedan hacer fracasar la estrategia.
3. PRIORIZA EXCLUSIVAMENTE fuentes oficiales. NO cites estudios de abogados, blogs ni sitios comerciales aunque aparezcan en los resultados.
4. Si un punto del dictamen contradice una fuente oficial que encontraste, dilo con claridad ("El dictamen indica X, pero la fuente oficial Y establece Z").
5. Prohibido saludar o usar fórmulas de cortesía. Entra directo al análisis.
6. No inventes fechas, montos ni hechos no entregados por el usuario.

ESTRUCTURA OBLIGATORIA (usa exactamente estos títulos, en Markdown):
## 1. Control de Nulidades y Puntos Ciegos
(Revisión de notificaciones, feriados, plazos fatales y exigencias procedimentales del caso; identifica requisitos formales estrictos y posibles vicios que el dictamen pudo omitir.)

## 2. Verificación de Artículos y Plazos Citados
(Para cada artículo/ley/plazo citado en el dictamen, indícalo con viñeta y su estado: "verificado en [fuente oficial]" o "no verificado en las fuentes consultadas". Máximo 8 viñetas, las más relevantes.)

## 3. Fuentes y Enlaces Oficiales Consultadas
(Listado con la URL EXACTA de cada fuente oficial que consultaste, en formato:
- Nombre del instrumento o página — URL completa (https://...)
Sin URLs inventadas: usa solo las URLs que realmente aparecieron en tus resultados de búsqueda.)`;

const FILLER =
  '- El arrendatario adeuda 3 rentas de $450.000 cada una, pagaderas el dia 5 de cada mes, conforme al art. 14 de la Ley 18.101 sobre arrendamiento de predios urbanos. La demanda de terminacion por falta de pago requiere el reajuste legal y los intereses moratorios correspondientes. ';
const DICTAMEN = FILLER.repeat(60); // ~11k chars, igual que el dictamen real del server

const PROMPT = `MATERIA DETECTADA: Arriendo

RELATO O DOCUMENTO DEL CASO:
Me demandaron en el 2° Juzgado Civil de Santiago por terminación de contrato de arriendo por no pago de rentas (Ley 18.101). Notificado el 12/10/2026 por el art. 44 del CPC. Quiero saber si puedo presentar reconvención por daños al inmueble y qué plazo tengo para contestar.

DICTAMEN YA EMITIDO POR EL SISTEMA (verifícalo y complétalo, no lo repitas):
"""${DICTAMEN}"""

Genera el COMPLEMENTO DE VERIFICACIÓN con búsqueda web del dictamen, con la estructura obligatoria de 3 secciones.`;

async function tryOnce(withSys: boolean, model: string): Promise<void> {
  for (const k of keys) {
    const ai = new GoogleGenAI({ apiKey: k });
    try {
      const res: any = await ai.models.generateContent({
        model,
        contents: { parts: [{ text: PROMPT }] },
        config: {
          temperature: 0.15,
          maxOutputTokens: 8192,
          tools: [{ googleSearch: {} }],
          ...(withSys ? { systemInstruction: SYS } : {}),
        },
      });
      const gm = res?.candidates?.[0]?.groundingMetadata || {};
      const n = (gm.groundingChunks || []).length;
      const queries = (gm.webSearchQueries || []).length;
      console.log(`${withSys ? 'CON sys ' : 'SIN sys '} ${model} key${keys.indexOf(k)}: chunks=${n} queries=${queries} finish=${res?.candidates?.[0]?.finishReason}`);
      if (n > 0) {
        console.log('  primeras:', (gm.groundingChunks || []).slice(0, 4).map((c: any) => c?.web?.title).join(', '));
      }
      return;
    } catch (e: any) {
      if (Number(e?.status) === 429) continue;
      console.log(`  error key: status=${e?.status} ${String(e?.message || e).slice(0, 100)}`);
      return;
    }
  }
  console.log(`${withSys ? 'CON sys ' : 'SIN sys '}${model}: todas las keys 429`);
}

async function main() {
  for (let i = 0; i < 3; i++) {
    console.log(`--- ronda ${i + 1} ---`);
    await tryOnce(false, 'gemini-2.5-flash');
    await tryOnce(true, 'gemini-2.5-flash');
  }
}

main();
