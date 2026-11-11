// viasProcesales.ts — Fase I.5: catálogo de vías procesales como datos.
//
// Agregar una materia o vía nueva = agregar una entrada, sin lógica nueva.
// Todos los requisitos parten con verificadaPorAbogado: false (hipótesis de
// trabajo para que un abogado las valide).

import type { Caso, Documento } from "./caso.schema.js";

export type Estado = "cumple" | "no_cumple" | "falta_dato";

export interface Requisito {
  id: string;
  pregunta: string;                       // se le hace al usuario si falta el dato
  evaluar: (c: Caso, hoy: Date) => Estado;
}

export interface ViaDef {
  id: string;
  nombre: string;
  materia: Caso["materia"];
  prioridad: number;                      // mayor = más específica y preferible
  requisitos: Requisito[];
  normasBase: string[];                   // ej. "Ley 19.983", "CPC arts. 434 y ss."
  plazoId?: string;                       // id en plazosChile.ts si existe
  verificadaPorAbogado: boolean;          // TODAS parten en false
}

const docs = (c: Caso, tipo: Documento["tipo"]) => c.documentos.filter((d) => d.tipo === tipo);
const tri = (v: "si" | "no" | "desconocido", bueno: "si" | "no"): Estado =>
  v === "desconocido" ? "falta_dato" : v === bueno ? "cumple" : "no_cumple";

// ⚠️ Los requisitos jurídicos de abajo son HIPÓTESIS DE TRABAJO para que un
// abogado las valide. No presentarlas al usuario como verificadas.

const EJECUTIVO_FACTURA: ViaDef = {
  id: "ejecutivo_factura",
  nombre: "Juicio ejecutivo por factura (Ley 19.983)",
  materia: "civil",
  prioridad: 90,
  verificadaPorAbogado: false,
  normasBase: ["Ley 19.983", "CPC arts. 434 y ss."],
  plazoId: "civil_ejecutivo_oposicion",
  requisitos: [
    { id: "hay_factura", pregunta: "¿Existe una factura que respalde la deuda?",
      evaluar: (c) => (docs(c, "factura").length ? "cumple" : "no_cumple") },
    { id: "recibo_conformidad", pregunta: "¿La factura tiene recibo de conformidad de la mercadería o del servicio (firmado o acusado)?",
      evaluar: (c) => { const f = docs(c, "factura")[0]; return f ? tri(f.reciboConformidad, "si") : "no_cumple"; } },
    { id: "sin_reclamo", pregunta: "¿El deudor reclamó el contenido de la factura dentro del plazo legal?",
      evaluar: (c) => { const f = docs(c, "factura")[0]; return f ? tri(f.reclamada, "no") : "no_cumple"; } },
    { id: "accion_no_prescrita", pregunta: "¿Cuál es la fecha de vencimiento de la factura?",
      // Plazo de prescripción de la acción ejecutiva: 1 año (dato aportado por el dueño
      // del producto, art. 10 Ley 19.983; validar con abogado).
      evaluar: (c, hoy) => {
        const f = docs(c, "factura")[0];
        if (!f || !f.fechaVencimiento) return "falta_dato";
        const lim = new Date(f.fechaVencimiento); lim.setFullYear(lim.getFullYear() + 1);
        return hoy <= lim ? "cumple" : "no_cumple";
      } },
  ],
};

const ORDINARIO_CUMPLIMIENTO: ViaDef = {
  id: "ordinario_civil_cumplimiento",
  nombre: "Juicio ordinario civil (cumplimiento / indemnización)",
  materia: "civil",
  prioridad: 10,                          // residual: solo si nada más específico aplica
  verificadaPorAbogado: false,
  normasBase: ["CC arts. 1545, 1556, 1557, 1698", "CPC juicio ordinario"],
  plazoId: "civil_contestacion",
  requisitos: [
    { id: "hay_obligacion", pregunta: "¿Qué obligación incumplió la contraparte y en qué documento o acuerdo consta?",
      evaluar: (c) => (c.documentos.length || c.hechos.length ? "cumple" : "falta_dato") },
  ],
};

// TODO (abogado + agente): agregar entradas siguiendo el mismo molde para
// monitorio_arrendamiento (Ley 18.101), despido_laboral, tutela_laboral,
// alimentos y prescripcion_multa_transito. Cada una con verificadaPorAbogado:false.

export const CATALOGO: ViaDef[] = [EJECUTIVO_FACTURA, ORDINARIO_CUMPLIMIENTO];

export type DecisionVia =
  | { estado: "decidida"; via: string; razones: string[] }
  | { estado: "requiere_datos"; via: string; preguntas: string[]; alternativa: string | null }
  | { estado: "sin_via"; via: "indeterminada"; preguntas: string[] };

export function decidirVia(caso: Caso, hoy: Date = new Date()): DecisionVia {
  const evaluadas = CATALOGO.filter((v) => v.materia === caso.materia).map((via) => {
    const ev = via.requisitos.map((r) => ({ ...r, estado: r.evaluar(caso, hoy) }));
    return {
      via,
      viable: ev.every((e) => e.estado === "cumple"),
      bloqueada: ev.some((e) => e.estado === "no_cumple"),
      faltan: ev.filter((e) => e.estado === "falta_dato"),
    };
  });
  const porPrioridad = (a: { via: ViaDef }, b: { via: ViaDef }) => b.via.prioridad - a.via.prioridad;
  const mejorViable = evaluadas.filter((e) => e.viable).sort(porPrioridad)[0];
  const mejorPendiente = evaluadas.filter((e) => !e.bloqueada && e.faltan.length).sort(porPrioridad)[0];

  // Una vía más específica con datos pendientes gana a una residual ya viable:
  // hay que preguntar antes de caer en ordinario por defecto.
  if (mejorPendiente && (!mejorViable || mejorPendiente.via.prioridad > mejorViable.via.prioridad)) {
    return {
      estado: "requiere_datos",
      via: mejorPendiente.via.id,
      preguntas: mejorPendiente.faltan.map((f) => f.pregunta),
      alternativa: mejorViable ? mejorViable.via.id : null,
    };
  }
  if (mejorViable) {
    return { estado: "decidida", via: mejorViable.via.id, razones: mejorViable.via.requisitos.map((r) => r.id) };
  }
  return { estado: "sin_via", via: "indeterminada", preguntas: caso.faltantes };
}
