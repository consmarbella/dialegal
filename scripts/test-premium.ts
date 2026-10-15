import * as fs from 'fs';

// Piloto de la capa premium (grounding web oficial).
// Llama a POST /api/premium-report en local. No toca la página.
const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:3000';

const CASOS = [
  {
    id: 1,
    tipo: 'Arriendo con reconvención',
    materiaEsperada: 'Arriendo',
    userStory:
      'Me demandaron en el 2° Juzgado Civil de Santiago por terminación de contrato de arriendo por no pago de rentas (Ley 18.101). Notificado el 12/10/2026 por el art. 44 del CPC. Quiero saber si puedo presentar reconvención por daños al inmueble y qué plazo tengo para contestar.',
  },
  {
    id: 2,
    tipo: 'Juicio ejecutivo pagaré',
    materiaEsperada: 'ejecutivo',
    userStory:
      'Notificado con mandamiento de ejecución y embargo en el 1° Juzgado de Letras de San Bernardo por un pagaré de $12.000.000. ¿Qué excepciones del Art. 464 del Código de Procedimiento Civil puedo oponer y en qué plazo?',
  },
  {
    id: 3,
    tipo: 'Autodespido laboral',
    materiaEsperada: 'Laboral',
    userStory:
      'Envié carta de autodespido (Art. 171 del Código del Trabajo) a mi empleador por no pago de remuneraciones durante 3 meses. La carta fue enviada a la Inspección del Trabajo el 05/10/2026. ¿Qué plazo tengo para demandar y qué indemnizaciones me corresponden?',
  },
];

interface ResultadoCaso {
  id: number;
  tipo: string;
  estado: string;
  duracionSegundos?: number;
  materia?: string;
  grounded?: boolean;
  fuentesCount?: number;
  fuentesOficialesCount?: number;
  ejemplosFuentes?: string[];
  urlsSeccion3Count?: number;
  urlsOficialesSeccion3Count?: number;
  ejemplosUrlsSeccion3?: string[];
  seccionesOk?: boolean;
  tieneSaludoProhibido?: boolean;
  citasNormativasCount?: number;
  muestraCitas?: string[];
  error?: string;
}

function contarOficiales(items: Array<{ title?: string; uri?: string; domain?: string }>): string[] {
  const oficial = /bcn\.cl|leychile|pjud\.cl|dt\.gob\.cl|dti\.gob\.cl|bcu\.cl|gob\.cl|contraloria\.cl|sernac\.cl|diariooficial|igm\.cl|senado\.cl|camara\.cl|mintrab|minrelab/i;
  const vistos = new Set<string>();
  const oficiales: string[] = [];
  for (const it of items) {
    const hay = `${it.title || ''} ${it.domain || ''} ${it.uri || ''}`;
    if (oficial.test(hay)) {
      const key = it.domain || it.title || it.uri || '';
      if (!vistos.has(key)) {
        vistos.add(key);
        oficiales.push(it.domain || it.title || key);
      }
    }
  }
  return oficiales;
}

function extraerUrlsSeccion3(markdown: string): string[] {
  const lines = markdown.split('\n');
  let inSec3 = false;
  const urls: string[] = [];
  for (const line of lines) {
    if (/Fuentes y Enlaces Oficiales/i.test(line)) inSec3 = true;
    else if (inSec3 && /^##\s/.test(line)) break;
    if (inSec3) {
      const matches = line.match(/https?:\/\/[^\s)\]]+/g);
      if (matches) urls.push(...matches);
    }
  }
  return urls;
}

function extraerCitas(markdown: string): string[] {
  const lines = markdown.split('\n');
  const citas: string[] = [];
  for (const line of lines) {
    if (/(art[ií]culo|art\.|ley n|ley 18|ley 19|c[oó]digo|decreto|CPC|CT)/i.test(line) && line.trim().length > 20) {
      citas.push(line.trim().slice(0, 180));
      if (citas.length >= 5) break;
    }
  }
  return citas;
}

async function correrCaso(caso: (typeof CASOS)[number]): Promise<ResultadoCaso> {
  const inicio = Date.now();
  console.log(`\n----------------------------------------`);
  console.log(`[Caso ${caso.id}/3] Premium (${caso.tipo})...`);

  try {
    const controller = new AbortController();

    // 1) Dictamen normal (como lo haría la UI) — se le pasa al premium como contexto.
    let dictamenMarkdown = '';
    try {
      const t1 = setTimeout(() => controller.abort(), 180000);
      const r1 = await fetch(`${BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userStory: caso.userStory, area: 'civil', documentText: '', notificationDate: '', files: [] }),
        signal: controller.signal,
      });
      clearTimeout(t1);
      if (r1.ok) {
        const d1: any = await r1.json().catch(() => ({}));
        dictamenMarkdown = d1.analysis || '';
      }
    } catch {
      /* sin dictamen el premium igual funciona (modo standalone) */
    }

    // 2) Premium (complemento Web RAG con el dictamen original).
    const timer = setTimeout(() => controller.abort(), 240000);
    const resp = await fetch(`${BASE}/api/premium-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userStory: caso.userStory, area: caso.tipo, dictamenMarkdown }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data: any = await resp.json().catch(() => ({}));
    const duracion = Math.round((Date.now() - inicio) / 1000);

    if (!resp.ok) {
      console.error(`❌ [Caso ${caso.id}] HTTP ${resp.status}: ${data.error || 'sin detalle'}`);
      return { id: caso.id, tipo: caso.tipo, estado: `FALLO_HTTP_${resp.status}`, error: data.error };
    }

    const report: string = data.report || '';
    const sources: Array<{ title: string; uri: string; domain?: string }> = data.sources || [];
    const uris = sources.map((s) => s.uri);
    const oficiales = contarOficiales(sources);
    const urlsSeccion3 = extraerUrlsSeccion3(report);
    const urlsOficialesS3 = contarOficiales(urlsSeccion3.map((u) => ({ uri: u })));

    // Estructura v4 (complemento): Control de Nulidades + Verificación de Artículos + Fuentes.
    const seccionesOk =
      report.includes('Verificación de Artículos') &&
      report.includes('Control de Nulidades') &&
      report.includes('Fuentes y Enlaces Oficiales');

    const tieneSaludo = /Estimado (cliente|usuario)/i.test(report);
    const citas = extraerCitas(report);

    const resultado: ResultadoCaso = {
      id: caso.id,
      tipo: caso.tipo,
      estado: 'EXITO',
      duracionSegundos: duracion,
      materia: data.materia,
      grounded: data.grounded,
      fuentesCount: uris.length,
      fuentesOficialesCount: oficiales.length,
      ejemplosFuentes: oficiales.slice(0, 5),
      urlsSeccion3Count: urlsSeccion3.length,
      urlsOficialesSeccion3Count: urlsOficialesS3.length,
      ejemplosUrlsSeccion3: urlsOficialesS3.slice(0, 5),
      seccionesOk,
      tieneSaludoProhibido: tieneSaludo,
      citasNormativasCount: citas.length,
      muestraCitas: citas.slice(0, 3),
    };

    const materiaOk = String(data.materia || '').toLowerCase().includes(caso.materiaEsperada.toLowerCase());
    console.log(
      `✅ [Caso ${caso.id}] ${duracion}s | materia="${data.materia}" (${materiaOk ? 'OK' : 'REVISAR'}) | grounded=${data.grounded} | fuentes=${uris.length} (oficiales=${oficiales.length}) | URLs en S3=${urlsSeccion3.length} (oficiales=${urlsOficialesS3.length}) | secciones=${seccionesOk} | saludoProhibido=${tieneSaludo} | citas=${citas.length}`
    );
    return resultado;
  } catch (err: any) {
    const duracion = Math.round((Date.now() - inicio) / 1000);
    const esTimeout = err?.name === 'AbortError';
    console.error(`❌ [Caso ${caso.id}] ${esTimeout ? 'TIMEOUT 240s' : 'ERROR'}: ${String(err?.message || err).slice(0, 200)}`);
    return {
      id: caso.id,
      tipo: caso.tipo,
      estado: esTimeout ? 'FALLO_TIMEOUT' : 'FALLO',
      duracionSegundos: duracion,
      error: String(err?.message || err).slice(0, 300),
    };
  }
}

async function main() {
  console.log(`🚀 Piloto premium (grounding oficial) contra ${BASE} ...`);
  const resultados: ResultadoCaso[] = [];
  let exitosos = 0;

  for (const caso of CASOS) {
    const r = await correrCaso(caso);
    resultados.push(r);
    if (r.estado === 'EXITO') exitosos++;
    // Pausa entre casos para no saturar la cadena de modelos
    await new Promise((r) => setTimeout(r, 4000));
  }

  const resumen = {
    totalCasos: CASOS.length,
    exitosos,
    fallos: CASOS.length - exitosos,
    fecha: new Date().toISOString(),
  };

  fs.writeFileSync('reporte_premium_piloto.json', JSON.stringify({ resumen, detalles: resultados }, null, 2));
  console.log('\n========================================');
  console.log(`🏁 Piloto premium finalizado. Exitosos: ${exitosos}/3`);
  console.log("Resultados en 'reporte_premium_piloto.json'.");
}

main().catch((e) => {
  console.error('ERR fatal:', String(e).slice(0, 300));
  process.exit(1);
});
