// Capa ② del pipeline: sinónimos / jerga chilena → forma canónica antes del
// clasificador de materias. Solo reescribe variantes léxicas; no inventa hechos.
// Se aplica sobre una copia del texto para scoring (el prompt original no se muta).

/** Pares: patrón → término canónico que refuerza señales en materias.ts */
const REEMPLAZOS: Array<{ re: RegExp; por: string }> = [
  // Laboral
  { re: /\bfiniquitad[oa]s?\b/gi, por: "finiquito despido" },
  { re: /\bme\s+(?:echaron|rajaron|mandaron\s+a\s+la\s+casa)\b/gi, por: "despido" },
  { re: /\bpuse\s+la\s+renuncia\b/gi, por: "renuncia voluntaria termino de contrato" },
  { re: /\bcotiz(?:aciones|ando)\s+(?:atrasadas|impagas|adeudadas)\b/gi, por: "cotizaciones previsionales impagas mora previsional" },
  { re: /\bAFP\b/g, por: "AFP cotizaciones previsionales" },
  { re: /\bAFC\b/g, por: "AFC seguro de cesantia" },
  { re: /\bsueldo\s+base\b/gi, por: "remuneracion sueldo base" },
  { re: /\bhoras\s+extras?\b/gi, por: "horas extraordinarias" },
  { re: /\bvacaciones\s+(?:pendientes|proporcionales)\b/gi, por: "feriado legal proporcional" },
  { re: /\bley\s+karin\b/gi, por: "Ley Karin acoso laboral" },
  // Civil / cobro
  { re: /\bpagar[eé]\b/gi, por: "pagare titulo ejecutivo" },
  { re: /\bcheque\s+(?:protestado|sin\s+fondos)\b/gi, por: "cheque protestado cobro" },
  { re: /\barriendo\b/gi, por: "arrendamiento predio urbano" },
  { re: /\bdesahucio\b/gi, por: "desahucio terminacion arrendamiento" },
  // Familia
  { re: /\bpensi[oó]n\s+de\s+alimentos?\b/gi, por: "pension de alimentos alimentos" },
  { re: /\bcuidad[oa]\s+personal\b/gi, por: "cuidado personal hijos familia" },
  { re: /\brelaci[oó]n\s+directa\s+y\s+regular\b/gi, por: "relacion directa y regular visitas familia" },
  // Tránsito / JPL
  { re: /\bparte\s+de\s+tr[aá]nsito\b/gi, por: "infraccion de transito parte" },
  { re: /\bmulta\s+de\s+tr[aá]nsito\b/gi, por: "infraccion transito multa" },
  // Penal coloquial (cuidado: no forzar materia)
  { re: /\bme\s+denunciaron\s+por\s+golpe(?:ar|s)\b/gi, por: "lesiones denuncia penal" },
];

/** Texto ampliado solo para clasificación / retrieval, no para mostrar al usuario. */
export function expandirJergaChile(texto: string): string {
  if (!texto || !texto.trim()) return texto || "";
  let out = texto;
  for (const { re, por } of REEMPLAZOS) {
    out = out.replace(re, por);
  }
  return out;
}
