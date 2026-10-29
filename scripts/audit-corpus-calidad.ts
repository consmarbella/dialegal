// Fase 8 - Auditoria de calidad del corpus y de lo que llega a los prompts.
// NO modifica datos: mide. Artefacto -> evaluation/jurisprudencia/audit-corpus-calidad.json
//
// Mide:
//  (a) candidatos a ficha-junk en corpus-full (5.711): institucion que empieza con
//      infinitivo administrativo o queda truncada ("... reclamos y") SIN falloRector;
//  (c) los casos semilla sospechosos (roles redondos, caratula generica, link generico);
//  (d) tamano de contenido (para decidir el slice que llega al LLM).
//  Muestra determinista de candidatos para revision manual (mismas reglas que Fase 3).
import * as fs from "fs";
import * as path from "path";

const AREAS = ["laboral", "civil", "familia", "penal", "administrativo", "constitucional", "transversal"];
const OUT = path.resolve("evaluation/jurisprudencia/audit-corpus-calidad.json");

// Patron de precision alta (a validar con revision manual):
//  (1) institucion empieza con infinitivo -ar/-er/-ir (instruccion administrativa)
//  (2) institucion truncada: termina en conector/preposicion ("y", "de", "la", ...)
const INFINITIVO_START = /^(chequear|atender|ejercer|entregar|publicar|canalizar|supervisar|verificar|registrar|remitir|administrar|coordinar|llevar|mantener|cumplir|controlar|informar|emitir|confeccionar|otorgar|realizar|efectuar|preparar|archivar|enviar|recibir|custodiar|elaborar|implementar|difundir|garantizar|procurar|velar|fiscalizar|designar|nombrar|convocar|decretar|disponer|resolver|conocer|devenir)\b/i;
const TRUNCADA_END = /(\s(y|o|u|e|de|del|la|el|los|las|un|una|su|sus|para|por|con|en|a|que|se|al|lo)\.?)$/i;

interface Candidato {
  id: string;
  area: string;
  institucion: string;
  motivo: string;
  conRector: boolean;
  autor: string;
  tokens: number;
  definicionHead: string;
}

function clasificar(area: string, fichas: any[]): { candidatos: Candidato[]; ok: number } {
  const candidatos: Candidato[] = [];
  let ok = 0;
  for (const f of fichas) {
    const inst = String(f.institucion || "").trim();
    const conRector = !!(f.falloRector && f.falloRector.rol);
    let motivo = "";
    if (!conRector) {
      if (INFINITIVO_START.test(inst)) motivo = "infinitivo_inicio";
      else if (TRUNCADA_END.test(inst) && inst.length > 20) motivo = "truncada";
    }
    if (motivo) {
      candidatos.push({
        id: f.id, area, institucion: inst, motivo, conRector,
        autor: f.autor || "", tokens: f.tokens || 0,
        definicionHead: String(f.definicion || "").slice(0, 120),
      });
    } else ok++;
  }
  return { candidatos, ok };
}

const resumen: any = { generado: new Date().toISOString(), areas: {}, porMotivo: {}, totalFichas: 0, totalCandidatos: 0, ok: 0 };
const todos: Candidato[] = [];
for (const a of AREAS) {
  const j = JSON.parse(fs.readFileSync(path.resolve("data/corpus-full", `${a}.json`), "utf8"));
  const { candidatos, ok } = clasificar(a, j.fichas);
  resumen.areas[a] = { fichas: j.fichas.length, ok, candidatos: candidatos.length };
  resumen.totalFichas += j.fichas.length;
  resumen.ok += ok;
  resumen.totalCandidatos += candidatos.length;
  for (const c of candidatos) resumen.porMotivo[c.motivo] = (resumen.porMotivo[c.motivo] || 0) + 1;
  todos.push(...candidatos);
}

// Muestra determinista estratificada para revision manual (max 30)
const muestra: Candidato[] = [];
for (const a of AREAS) {
  const del = todos.filter(c => c.area === a);
  const paso = Math.max(1, Math.floor(del.length / Math.ceil(30 * (del.length / todos.length) || 1)));
  for (let i = 0; i < del.length && muestra.filter(m => m.area === a).length < Math.ceil(30 * (del.length / todos.length)); i += paso) muestra.push(del[i]);
}

// (c) casos semilla
const cj = JSON.parse(fs.readFileSync(path.resolve("data/jurisprudencia-casos.json"), "utf8"));
const semillas = cj.casos.filter((c: any) => c.tipo === "caso" && /^Rol N° \d{1,2}\.\d{3}-\d{4}$/.test(c.rol || "") || c.tipo === "fallo_rector");
resumen.casos = {
  total: cj.casos.length, fichaCs: cj.casos.filter((c: any) => c.tipo === "ficha_cs").length,
  casoTc: cj.casos.filter((c: any) => c.tipo === "caso").length,
  semillasSospechosas: semillas.map((c: any) => ({ rol: c.rol, caratula: c.caratula, link: c.link, tipo: c.tipo })),
};

// (d) tamano de contenido
const lens: number[] = [];
for (const a of AREAS) {
  const j = JSON.parse(fs.readFileSync(path.resolve("data/corpus-full", `${a}.json`), "utf8"));
  for (const f of j.fichas) if (f.contenido) lens.push(f.contenido.length);
}
lens.sort((x, y) => x - y);
const q = (p: number) => lens[Math.floor(p * (lens.length - 1))];
resumen.contenido = { n: lens.length, p50: q(0.5), p90: q(0.9), p99: q(0.99), max: lens[lens.length - 1] };

resumen.muestraManual = muestra;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(resumen, null, 2), "utf-8");
console.log(`fichas=${resumen.totalFichas} ok=${resumen.ok} candidatos=${resumen.totalCandidatos} (${(100 * resumen.totalCandidatos / resumen.totalFichas).toFixed(1)}%)`);
console.log("porArea=" + JSON.stringify(resumen.areas));
console.log("porMotivo=" + JSON.stringify(resumen.porMotivo));
console.log("semillas=" + JSON.stringify(resumen.casos.semillasSospechosas.map((s: any) => s.rol)));
console.log("contenido p50=" + resumen.contenido.p50 + " p90=" + resumen.contenido.p90 + " p99=" + resumen.contenido.p99);
console.log("muestra manual=" + muestra.length + " -> " + OUT);