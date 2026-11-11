// extraerCaso.ts — Fase I.5: extracción de caso con LLM + salida estructurada.
//
// UNA sola llamada a Gemini (temperature: 0) siguiendo EXACTAMENTE el patrón
// de src/server/materiaLLm.ts (mismo generateWithFallback, mismo timeout, mismo
// "si falla devuelve null"). responseMimeType: "application/json" + responseSchema
// escrito a mano (estilo materiaLLM.ts) porque @google/genai ^2.4.0 no se ha
// verificado que acepte JSON Schema generado desde Zod.
//
// Aunque Gemini garantice la forma, siempre se re-valida con CasoSchema.safeParse.
// Si falla: devuelve null y el flujo actual sigue sin cambios.
//
// Detrás de flag NUCLEO_TIPADO=true (legalhelp-draft.ts). Con el flag apagado
// este módulo no se importa ni se usa.

import type { GoogleGenAI } from "@google/genai";
import { generateWithFallback } from "./llmEngine.js";
import {
  CasoSchema,
  type Caso,
  type Documento,
  MATERIAS,
  TIPOS_ESCRITO,
  POSTURAS,
  TRI,
} from "./caso.schema.js";

// Timeout propio: la extracción no puede frenar el flujo principal.
const TIMEOUT_MS = 25_000;

const SYSTEM_INSTRUCTION = `Eres un extractor de hechos para casos jurídicos chilenos. NO redactas escritos ni das opiniones jurídicas.
Reglas:
1. Extrae SOLO lo que el texto dice. Si un dato no está, usa null (o "desconocido"). NUNCA inventes nombres, RUT, fechas, montos ni números de documento.
2. Fechas en formato ISO YYYY-MM-DD. Montos como entero en pesos chilenos, sin puntos ni símbolos.
3. En cada documento y hecho, "citaTextual" debe ser una frase copiada literalmente del texto.
4. Si no hay causa judicial en curso, estadoProcesal.causaIniciada = "no" y rit = null. Un RIT/ROL que aparezca solo como cita de la contraparte o de un fallo NO es el rol de este caso.
5. Si falta un dato necesario para decidir la vía (por ejemplo: si la factura fue reclamada o tiene recibo de conformidad), agrégalo como pregunta en "faltantes".
6. Si no puedes determinar la materia, usa "indeterminada".
7. viaPropuesta: propón una vía procesal chilena para el caso (ej. "Juicio ejecutivo por pagaré", "Juicio ordinario civil", "Contestación de demanda laboral"). Si no la determinas, usa null.
8. normasARevisar: lista de normas (nombre o "Ley N° X" o "Código X art. Y") que el caso invoca y que deben verificarse contra BCN. Solo normas que aparezcan o se infieran del texto; no inventes.
9. preguntas: preguntas adicionales para el usuario sobre datos que falten para decidir la vía. Puede coincidir con faltantes.`;

/** responseSchema escrito a mano (estilo materiaLLM.ts). Coincide con CasoSchema. */
const RESPONSE_SCHEMA: any = {
  type: "OBJECT",
  required: ["materia", "tipoEscrito", "postura", "partes", "documentos", "hechos", "pretensiones", "estadoProcesal", "faltantes", "viaPropuesta", "normasARevisar", "preguntas"],
  propertyOrdering: [
    "materia", "tipoEscrito", "postura", "partes", "documentos", "hechos", "pretensiones", "estadoProcesal", "faltantes", "viaPropuesta", "normasARevisar", "preguntas",
  ],
  properties: {
    materia: { type: "STRING", enum: [...MATERIAS] },
    tipoEscrito: { type: "STRING", enum: [...TIPOS_ESCRITO], nullable: true },
    postura: { type: "STRING", enum: [...POSTURAS] },
    partes: {
      type: "ARRAY",
      maxItems: 5,
      items: {
        type: "OBJECT",
        required: ["rol", "nombre", "rut", "tipoPersona", "domicilio", "representante"],
        properties: {
          rol: { type: "STRING", enum: ["demandante", "demandado", "tercero"] },
          nombre: { type: "STRING", nullable: true },
          rut: { type: "STRING", nullable: true },
          tipoPersona: { type: "STRING", enum: ["natural", "juridica", "desconocido"] },
          domicilio: { type: "STRING", nullable: true },
          representante: { type: "STRING", nullable: true },
        },
      },
    },
    documentos: {
      type: "ARRAY",
      maxItems: 10,
      items: {
        type: "OBJECT",
        required: ["tipo", "numero", "fechaEmision", "fechaVencimiento", "montoClp", "reciboConformidad", "reclamada", "citaTextual"],
        properties: {
          tipo: {
            type: "STRING",
            enum: [
              "factura", "pagare", "letra_cambio", "cheque", "contrato",
              "carta_despido", "finiquito", "liquidacion", "acta_notificacion",
              "sentencia", "comprobante_pago", "correo", "otro",
            ],
          },
          numero: { type: "STRING", nullable: true },
          fechaEmision: { type: "STRING", nullable: true },
          fechaVencimiento: { type: "STRING", nullable: true },
          montoClp: { type: "NUMBER", nullable: true },
          reciboConformidad: { type: "STRING", enum: [...TRI] },
          reclamada: { type: "STRING", enum: [...TRI] },
          citaTextual: { type: "STRING" },
        },
      },
    },
    hechos: {
      type: "ARRAY",
      maxItems: 20,
      items: {
        type: "OBJECT",
        required: ["fecha", "descripcion", "citaTextual"],
        properties: {
          fecha: { type: "STRING", nullable: true },
          descripcion: { type: "STRING" },
          citaTextual: { type: "STRING" },
        },
      },
    },
    pretensiones: {
      type: "ARRAY",
      maxItems: 8,
      items: {
        type: "OBJECT",
        required: ["tipo", "montoClp", "descripcion"],
        properties: {
          tipo: {
            type: "STRING",
            enum: [
              "pago_de_suma", "cumplimiento_contrato", "indemnizacion_perjuicios",
              "resolucion_contrato", "restitucion", "nulidad", "prescripcion",
              "alimentos", "tutela", "otra",
            ],
          },
          montoClp: { type: "NUMBER", nullable: true },
          descripcion: { type: "STRING" },
        },
      },
    },
    estadoProcesal: {
      type: "OBJECT",
      required: ["causaIniciada", "rit", "tribunal", "fechaNotificacion"],
      properties: {
        causaIniciada: { type: "STRING", enum: [...TRI] },
        rit: { type: "STRING", nullable: true },
        tribunal: { type: "STRING", nullable: true },
        fechaNotificacion: { type: "STRING", nullable: true },
      },
    },
    faltantes: {
      type: "ARRAY",
      maxItems: 5,
      items: { type: "STRING" },
    },
    viaPropuesta: { type: "STRING", nullable: true },
    normasARevisar: {
      type: "ARRAY",
      maxItems: 10,
      items: { type: "STRING" },
    },
    preguntas: {
      type: "ARRAY",
      maxItems: 5,
      items: { type: "STRING" },
    },
  },
};

/** RUT chileno: valida dígito verificador por módulo 11. Acepta "12.345.678-9". */
export function rutValidoMod11(rut: string): boolean {
  const limpio = rut.replace(/[.\s-]/g, "");
  if (!/^\d{7,8}[0-9kK]$/.test(limpio)) return false;
  const cuerpo = limpio.slice(0, -1);
  const dvIngresado = limpio.slice(-1).toUpperCase();
  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplicador;
    multiplicador = multiplicador < 7 ? multiplicador + 1 : 2;
  }
  const dvCalculado = 11 - (suma % 11);
  const dvEsperado = dvCalculado === 11 ? "0" : dvCalculado === 10 ? "K" : String(dvCalculado);
  return dvEsperado === dvIngresado;
}

function normalizarEspacios(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function textoSinPuntosEspacios(t: string): string {
  return t.replace(/[.\s]/g, "");
}

/** Verificación cruzada con RegEx contra el texto original. Devuelve advertencias. */
export function verificarContraTexto(caso: Caso, texto: string): string[] {
  const advertencias: string[] = [];
  const textoPlano = textoSinPuntosEspacios(texto);
  const textoNorm = normalizarEspacios(texto).toLowerCase();

  // ── Documentos ──
  for (const d of caso.documentos) {
    if (d.montoClp != null) {
      const busca = String(d.montoClp);
      if (!textoPlano.includes(busca)) {
        advertencias.push(`monto de documento "${d.citaTextual}" (${busca}) no aparece en el texto; se elimina.`);
        d.montoClp = null;
      }
    }
    if (d.citaTextual && !textoNorm.includes(normalizarEspacios(d.citaTextual).toLowerCase())) {
      advertencias.push(`citaTextual de documento "${d.citaTextual.slice(0, 60)}" no es subcadena del texto; se elimina.`);
      d.citaTextual = "";
    }
    if (d.fechaEmision && !/^\d{4}-\d{2}-\d{2}$/.test(d.fechaEmision)) d.fechaEmision = null;
    if (d.fechaVencimiento && !/^\d{4}-\d{2}-\d{2}$/.test(d.fechaVencimiento)) d.fechaVencimiento = null;
  }

  // ── Pretensiones ──
  for (const p of caso.pretensiones) {
    if (p.montoClp != null) {
      const busca = String(p.montoClp);
      if (!textoPlano.includes(busca)) {
        advertencias.push(`monto de pretensión "${p.descripcion}" (${busca}) no aparece en el texto; se elimina.`);
        p.montoClp = null;
      }
    }
  }

  // ── Hechos ──
  for (const h of caso.hechos) {
    if (h.citaTextual && !textoNorm.includes(normalizarEspacios(h.citaTextual).toLowerCase())) {
      advertencias.push(`citaTextual de hecho "${h.citaTextual.slice(0, 60)}" no es subcadena del texto; se elimina.`);
      h.citaTextual = "";
    }
    if (h.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(h.fecha)) h.fecha = null;
  }

  // ── RUTs de partes ──
  for (const parte of caso.partes) {
    if (parte.rut && !rutValidoMod11(parte.rut)) {
      advertencias.push(`RUT de parte "${parte.nombre ?? "(sin nombre)"}" (${parte.rut}) no pasa módulo 11; se elimina.`);
      parte.rut = null;
    }
    if (parte.rut && !texto.includes(parte.rut)) {
      advertencias.push(`RUT de parte "${parte.nombre ?? "(sin nombre)"}" (${parte.rut}) no aparece en el texto; se elimina.`);
      parte.rut = null;
    }
  }

  return advertencias;
}

export interface ExtraerCasoResult {
  caso: Caso | null;
  advertencias: string[];
  usadoLLM: boolean;
}

export async function extraerCaso(
  clients: GoogleGenAI | GoogleGenAI[],
  texto: string,
): Promise<ExtraerCasoResult> {
  const relato = (texto || "").trim().slice(0, 12_000);
  if (relato.length < 40) return { caso: null, advertencias: [], usadoLLM: false };

  const payload = {
    contents: {
      parts: [{ text: `RELATO DEL USUARIO:\n"""\n${relato}\n"""\n\nExtrae los datos del caso en formato JSON.` }],
    },
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  };

  let caso: Caso | null = null;
  let advertencias: string[] = [];
  try {
    const resp = await Promise.race([
      generateWithFallback(clients, payload),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("extraerCaso-timeout")), TIMEOUT_MS)),
    ]);
    const raw = (resp as any)?.text
      ?? (resp as any)?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("")
      ?? "";
    const parsed = JSON.parse(raw);
    const resultado = CasoSchema.safeParse(parsed);
    if (!resultado.success) {
      // El flujo actual sigue: devuelve null sin romper nada.
      return { caso: null, advertencias: ["CasoSchema no validó la salida del LLM"], usadoLLM: true };
    }
    caso = resultado.data;
    // Verificación cruzada con RegEx contra el texto original.
    advertencias = verificarContraTexto(caso, relato);
  } catch {
    // Cuota agotada, saturación, JSON corrupto o timeout: no rompe el flujo.
    return { caso: null, advertencias: [], usadoLLM: false };
  }
  return { caso, advertencias, usadoLLM: true };
}

export { CasoSchema };
export type { Caso, Documento };
