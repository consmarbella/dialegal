import { z } from "zod";

export const MATERIAS = [
  "civil", "laboral", "familia", "penal",
  "administrativo", "constitucional", "transito", "indeterminada",
] as const;

export const TIPOS_ESCRITO = ["demanda", "contestacion", "otrosi", "minuta"] as const;
export const POSTURAS = ["demandante", "demandado", "indeterminada"] as const;
export const TRI = ["si", "no", "desconocido"] as const;

// Fechas siempre ISO (YYYY-MM-DD) o null. Montos siempre CLP enteros o null.
const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const MontoClp = z.number().int().nonnegative().nullable();

export const ParteSchema = z.object({
  rol: z.enum(["demandante", "demandado", "tercero"]),
  nombre: z.string().max(200).nullable(),
  rut: z.string().max(14).nullable(),          // validar módulo 11 en código, no aquí
  tipoPersona: z.enum(["natural", "juridica", "desconocido"]),
  domicilio: z.string().max(300).nullable(),
  representante: z.string().max(200).nullable(),
});

export const DocumentoSchema = z.object({
  tipo: z.enum([
    "factura", "pagare", "letra_cambio", "cheque", "contrato",
    "carta_despido", "finiquito", "liquidacion", "acta_notificacion",
    "sentencia", "comprobante_pago", "correo", "otro",
  ]),
  numero: z.string().max(60).nullable(),
  fechaEmision: Fecha,
  fechaVencimiento: Fecha,
  montoClp: MontoClp,
  // Solo relevante para factura (Ley 19.983). "desconocido" si el relato no lo dice.
  reciboConformidad: z.enum(TRI),
  reclamada: z.enum(TRI),
  // Frase textual del relato de donde sale este documento (trazabilidad).
  citaTextual: z.string().max(300),
});

export const HechoSchema = z.object({
  fecha: Fecha,
  descripcion: z.string().max(300),
  citaTextual: z.string().max(300),
});

export const PretensionSchema = z.object({
  tipo: z.enum([
    "pago_de_suma", "cumplimiento_contrato", "indemnizacion_perjuicios",
    "resolucion_contrato", "restitucion", "nulidad", "prescripcion",
    "alimentos", "tutela", "otra",
  ]),
  montoClp: MontoClp,
  descripcion: z.string().max(300),
});

export const EstadoProcesalSchema = z.object({
  causaIniciada: z.enum(TRI),        // ¿ya existe una causa en tribunal?
  rit: z.string().max(30).nullable(), // null es VÁLIDO y esperado en demandas
  tribunal: z.string().max(120).nullable(),
  fechaNotificacion: Fecha,
});

export const CasoSchema = z.object({
  materia: z.enum(MATERIAS),
  tipoEscrito: z.enum(TIPOS_ESCRITO).nullable(),   // null si el usuario no lo declaró
  postura: z.enum(POSTURAS),
  partes: z.array(ParteSchema).max(10),
  documentos: z.array(DocumentoSchema).max(30),
  hechos: z.array(HechoSchema).max(40),
  pretensiones: z.array(PretensionSchema).max(15),
  estadoProcesal: EstadoProcesalSchema,
  // Preguntas concretas para el usuario sobre datos que faltan (no inventar).
  faltantes: z.array(z.string().max(200)).max(10),
});

export type Caso = z.infer<typeof CasoSchema>;
export type Documento = z.infer<typeof DocumentoSchema>;

/** El RIT solo es exigible cuando la causa ya existe. En una demanda inicial NUNCA. */
export function ritEsExigible(tipo: Caso["tipoEscrito"]): boolean {
  return tipo === "contestacion" || tipo === "otrosi" || tipo === "minuta";
}
