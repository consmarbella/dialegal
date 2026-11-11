// materiaLLM.ts — Fase I: capa de respaldo LLM para la materia.
//
// SOLO se invoca cuando el clasificador determinista (señales + contexto +
// anclas + corpus) se abstiene o empata. Una sola llamada a un modelo flash
// con salida JSON ESTRUCTURADA (responseSchema): nada de parsear prosa.
// Si la respuesta no valida (slug desconocido, JSON corrupto, cuota agotada,
// timeout), devuelve null y el flujo mantiene la decisión determinista.
// Nunca es la primera opción: es el desempate con razones visibles.

import type { GoogleGenAI } from "@google/genai";
import { generateWithFallback } from "./llmEngine.js";
import { MATERIAS, SLUGS_MATERIA, type SlugMateria } from "../../materias.js";

export interface MateriaLLM {
  slug: SlugMateria | null;
  secundaria: SlugMateria | null;
  /** 0-1 según el propio modelo; <0.6 no se acepta */
  confianza: number;
  razones: string;
}

const SLUGS: SlugMateria[] = Array.from(SLUGS_MATERIA);

const DESCRIPCIONES: Record<SlugMateria, string> = {
  civil: "contratos (cumplimiento/incumplimiento, arrendamiento, compraventa, vicios, cláusula penal), responsabilidad extracontractual, indemnización de perjuicios, cobro de deudas, prescripción civil, comunidad, servidumbres",
  laboral: "despido (injustificado, necesidades de la empresa, nulidad del despido/Ley Bustos), cotizaciones previsionales impagas, tutela laboral, acoso laboral (Ley Karin), remuneraciones, feriado, sindicatos, subcontratación (art. 64-64 bis CT)",
  familia: "pensión de alimentos, cuidado personal/tuición, relación directa y regular, divorcio, violencia intrafamiliar, filiación, mediación familiar",
  penal: "delitos, querellas, fiscalía (Ministerio Público), formalización, prisión preventiva, derechos de la víctima",
  administrativo: "actos de la administración (municipalidades, servicios públicos), patentes, permisos, sumarios administrativos, Ley 19.880, reclamaciones, Contraloría",
  constitucional: "recurso de protección, amparo, garantías de la Constitución (art. 19), Tribunal Constitucional, derechos fundamentales fuera de la relación laboral",
  transito: "multas e infracciones de tránsito, Juzgado de Policía Local (JPL), licencia de conducir, TAG, permiso de circulación, alcoholemia, accidentes de tránsito",
};

/** Timeout propio: el respaldo no puede frenar el flujo principal. */
const TIMEOUT_MS = 20_000;

export async function decidirMateriaLLM(
  clients: GoogleGenAI | GoogleGenAI[],
  texto: string,
): Promise<MateriaLLM | null> {
  const relato = (texto || "").trim();
  if (relato.length < 80) return null; // relatos mínimos: el determinista basta
  const definiciones = SLUGS.map((s) => `- ${s} — ${MATERIAS[s].nombre}: ${DESCRIPCIONES[s]}`).join("\n");
  const payload = {
    contents: {
      parts: [{
        text: `RELATO DEL USUARIO (puede incluir un documento judicial pegado):\n"""\n${relato.slice(0, 6000)}\n"""\n\n¿De qué materia jurídica chilena es principalmente este caso?`,
      }],
    },
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          materia: { type: "STRING", enum: [...SLUGS, "indeterminada"] },
          materiaSecundaria: { type: "STRING", enum: [...SLUGS, "ninguna"] },
          confianza: { type: "NUMBER" },
          razones: { type: "STRING" },
        },
        required: ["materia", "materiaSecundaria", "confianza", "razones"],
        propertyOrdering: ["materia", "materiaSecundaria", "confianza", "razones"],
      },
      systemInstruction: `Eres un clasificador experto de materias jurídicas chilenas. Decides por el CONTEXTO del relato, nunca por una palabra suelta: "multa" puede ser cláusula penal contractual (civil), multa de tránsito (tránsito), previsional (laboral) o municipal (administrativo); "arrendamiento" puede ser el contrato mismo (civil) o solo un rubro de lucro cesante; "contratista" puede ser relación laboral o contrato de obra. Solo marca materiaSecundaria si el relato muestra un SEGUNDO asunto jurídico real y distinto (no una palabra incidental). Si el relato no alcanza para concluir, responde "indeterminada" con confianza baja. Las materias posibles:\n${definiciones}`,
    },
  };
  try {
    const resp = await Promise.race([
      generateWithFallback(clients, payload),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("materiaLLM-timeout")), TIMEOUT_MS)),
    ]);
    const raw = (resp as any)?.text
      ?? (resp as any)?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("")
      ?? "";
    const json = JSON.parse(raw);
    const materia = String(json?.materia ?? "");
    const secundaria = String(json?.materiaSecundaria ?? "");
    return {
      slug: (SLUGS as string[]).includes(materia) ? (materia as SlugMateria) : null,
      secundaria: (SLUGS as string[]).includes(secundaria) ? (secundaria as SlugMateria) : null,
      confianza: Math.max(0, Math.min(1, Number(json?.confianza) || 0)),
      razones: String(json?.razones ?? "").slice(0, 400),
    };
  } catch {
    // Cuota agotada, saturación, JSON corrupto o timeout: el respaldo NO
    // puede romper el flujo. Se devuelve null y se mantiene lo determinista.
    return null;
  }
}
