// Auditoría ciega v2: 30 casos con relatos complejos y comparación profunda.
// Corrige los errores de la v1: relatos repetidos, comparación superficial,
// sin verificar materia secundaria ni acciones detectadas.
import fs from "fs";
import path from "path";

interface CasoEval {
  id: string;
  areaEsperada: string;
  areaSecundariaEsperada?: string;
  institucion: string;
  falloRector: string | null;
  normasEsperadas: string[];
  relato: string;
  // Palabras que NO deben disparar señales equivocadas
  contextoNoTransito?: boolean;
  contextoNoLaboral?: boolean;
  contextoNoArrendamiento?: boolean;
}

// Extraer fichas con contenido suficiente del corpus
const areas = ["laboral", "civil", "familia", "transito", "administrativo", "penal"];
const fichas: any[] = [];
for (const a of areas) {
  const p = path.join("data", "corpus-full", `${a}.json`);
  if (!fs.existsSync(p)) continue;
  const d = JSON.parse(fs.readFileSync(p, "utf-8"));
  for (const f of d.fichas) {
    if ((f.contenido || "").length > 200 && (f.normas || []).length > 0 && (f.definicion || "").length > 50) {
      fichas.push({ ...f, areaCorpus: a });
    }
  }
}
console.log(`Fichas candidatas: ${fichas.length}`);

// Seleccionar 30 casos con VARIOSIDAD: mezclar temas que puedan confundir el clasificador
// Incluir: casos que mencionen "multa" sin ser tránsito, "contrata" sin ser laboral,
// "plazo" en contexto no-procesal, casos con montos altos, casos con palabras ambiguas

const seleccionadas: CasoEval[] = [];
const usadas = new Set<string>();

// Función para evitar duplicados por tema
function agregar(f: any, relato: string, areaSecundaria?: string, flags?: { noTransito?: boolean; noLaboral?: boolean; noArrendamiento?: boolean }) {
  if (usadas.has(f.institucion)) return;
  usadas.add(f.institucion);
  seleccionadas.push({
    id: `A${String(seleccionadas.length + 1).padStart(3, "0")}`,
    areaEsperada: f.areaCorpus,
    areaSecundariaEsperada: areaSecundaria,
    institucion: f.institucion?.slice(0, 100) || "",
    falloRector: f.falloRector?.rol || null,
    normasEsperadas: (f.normas || []).map((n: string) => n.replace("BCN - ", "")),
    relato,
    contextoNoTransito: flags?.noTransito,
    contextoNoLaboral: flags?.noLaboral,
    contextoNoArrendamiento: flags?.noArrendamiento,
  });
}

// ── LABORALES (8 casos con variedad) ──
const laborales = fichas.filter((f: any) => f.areaCorpus === "laboral");
for (const f of laborales) {
  if (seleccionadas.length >= 8) break;
  const inst = f.institucion || "";
  const def = (f.definicion || "") + " " + (f.contenido || "");
  
  if (/despido|necesidades de la empresa/i.test(inst)) {
    agregar(f, "Mi empresa me despidió el pasado lunes invocando necesidades de la empresa. Trabajé ahí 5 años y no me pagaron la indemnización completa. Además creo que las cotizaciones de los últimos 3 meses no fueron enteradas a la AFP. Necesito saber qué opciones tengo.", undefined, { noTransito: true, noArrendamiento: true });
  } else if (/subordinaci|ius variandi|primacía/i.test(inst)) {
    agregar(f, "Contraté con una empresa para hacer consultoría independiente pero en realidad llego todos los días a la oficina, uso su computador y me reporto a un jefe que me da instrucciones. Ahora me quieren echar sin paga. ¿Es correcto?", undefined, { noTransito: true, noArrendamiento: true });
  } else if (/tutela|derechos fundamentales/i.test(inst)) {
    agregar(f, "En la empresa donde trabajo el supervisor revisa mis correos personales, me exige que le comparta mi ubicación por teléfono fuera del horario y me amenazó con despedirme si presentaba una denuncia interna. ¿Qué puedo hacer?", undefined, { noTransito: true, noArrendamiento: true });
  } else if (/acoso|karin|hostigamiento/i.test(inst)) {
    agregar(f, "Mi jefa me grita delante de todos, me pone tareas imposibles de cumplir y luego me critica por no hacerlo bien. Ya la reporté a recursos humanos pero no hicieron nada. ¿Qué pasos legales puedo tomar?", undefined, { noTransito: true, noArrendamiento: true });
  } else if (/horas extra|jornada|descanso/i.test(inst)) {
    agregar(f, "Trabajo en turnos de noche de 12 horas y en mi contrato dice 45 horas semanales. Me pagan un solo sueldo fijo sin importar cuánto trabaje. ¿Tengo derecho a cobrar horas adicionales?", undefined, { noTransito: true, noArrendamiento: true });
  } else if (/fuero maternal|maternidad|embarazo/i.test(inst)) {
    agregar(f, "Estoy embarazada de 4 meses y mi empleador me cambió de un puesto administrativo a limpiar bodegas. Dice que es reorganización pero la otra persona que tomó mi cargo es un hombre que no está embarazado.", undefined, { noTransito: true, noArrendamiento: true });
  } else if (/contrata|subcontrata|mandante/i.test(inst)) {
    agregar(f, "Trabajo para una empresa contratista que presta servicios a una minera grande. La contratista me debe 3 meses de sueldo. ¿Puedo demandar directamente a la minera?", undefined, { noTransito: true, noArrendamiento: true });
  } else if (/sindical|antisindical/i.test(inst)) {
    agregar(f, "Formé un sindicato con 8 compañeros y el gerente me llamó a su oficina para decirme que si sigo con eso me va a echar. Estoy asustado pero no quiero abandonar el proyecto.", undefined, { noTransito: true, noArrendamiento: true });
  } else if (/cotizaciones|previsional|afp/i.test(inst)) {
    agregar(f, "Descubrí que mi empresa no pagó mis cotizaciones de AFP durante 6 meses. Me enteré cuando fui a pedir un crédito y me lo rechazaron. ¿Qué consecuencias tiene para mi empleador?", undefined, { noTransito: true, noArrendamiento: true });
  }
}

// ── CIVILES (10 casos con variedad, incluyendo palabras trampa) ──
const civiles = fichas.filter((f: any) => f.areaCorpus === "civil");
for (const f of civiles) {
  if (seleccionadas.filter(s => s.areaEsperada === "civil").length >= 10) break;
  const inst = f.institucion || "";
  const def = (f.definicion || "") + " " + (f.contenido || "");

  if (/multa|cláusula penal|pena|indemnizaci/i.test(inst)) {
    // TRAMPA: menciona "multa" pero es cláusula penal, no tránsito
    agregar(f, "Firmé un contrato de construcción con una constructora para una nave industrial de $200 millones. El contrato tiene una multa de 1500 UF por cada día de atraso. La obra se atrasó 3 meses. ¿La multa es proporcional o puedo pedir que la reduzcan?", undefined, { noTransito: true, noArrendamiento: true });
  } else if (/arrendamiento|arriendo/i.test(inst)) {
    agregar(f, "Mi arrendatario me debe 4 meses de arriendo de un local comercial. Le envié carta de desahucio pero sigue en el local. ¿Cómo lo saco legalmente?", undefined, { noTransito: true, noLaboral: true });
  } else if (/responsabi|daño|hecho ajeno/i.test(inst)) {
    // TRAMPA: "hecho ajeno" podría confundirse con laboral
    agregar(f, "La empresa constructora que contraté para arreglar mi casa dejó una viga mal instalada que colapsó y dañó el auto de mi vecino que estaba estacionado delante. El vecino me está demandando a mí. ¿Puedo transferirle la responsabilidad a la constructora?", undefined, { noTransito: true, noArrendamiento: true });
  } else if (/prescripci/i.test(inst)) {
    agregar(f, "Banco X me cobró una deuda de una tarjeta de crédito que no pago desde 2018. ¿Todavía pueden demandarme por eso o ya pasó el tiempo?", undefined, { noTransito: true, noLaboral: true, noArrendamiento: true });
  } else if (/comunidad|condomini|bienes/i.test(inst)) {
    agregar(f, "Heredé un terreno junto con mis 3 hermanos. Uno de ellos lo ocupa y lo explota comercialmente sin pagarme nada. Quiero saber si puedo vender mi porción sin su consentimiento.", undefined, { noTransito: true, noLaboral: true, noArrendamiento: true });
  } else if (/obligaci|contrato|cumplimiento/i.test(inst)) {
    agregar(f, "Contraté con una empresa de eventos para mi matrimonio. Pagué $2.000.000 de anticipo y se declararon en quiebra una semana antes del evento. No me devolvieron la plata ni me prestaron el servicio.", undefined, { noTransito: true, noLaboral: true, noArrendamiento: true });
  } else if (/compraventa|evicción|vicios/i.test(inst)) {
    agregar(f, "Compré un departamento nuevo y a los 6 meses aparecieron filtraciones en el techo y grietas en la pared. El constructor dice que es normal. ¿Tengo algún recurso legal?", undefined, { noTransito: true, noLaboral: true, noArrendamiento: true });
  } else if (/pago|deuda|cobranza|moros/i.test(inst)) {
    agregar(f, "Una empresa de cobranza me está llamando todos los días amenazándome con embargarme el auto por una deuda que no reconozco. Dicen que compraron mi deuda a un banco. ¿Qué derechos tengo?", undefined, { noTransito: true, noLaboral: true, noArrendamiento: true });
  } else if (/gasto|común|copropied/i.test(inst)) {
    agregar(f, "En mi edificio el administrador cobra gastos comunes sin mostrar en qué se gasta la plata. Pedí la contabilidad y me negó el acceso. ¿Es legal eso?", undefined, { noTransito: true, noLaboral: true, noArrendamiento: true });
  } else if (/servidumbre|propiedad|inmueble/i.test(inst)) {
    agregar(f, "Mi vecino instaló una cañería que pasa por mi terreno sin pedirme permiso ni pagarme nada. Cuando le reclamé me dijo que tiene derecho porque su casa es más antigua. ¿Es verdad?", undefined, { noTransito: true, noLaboral: true, noArrendamiento: true });
  }
}

// ── TRÁNSITO (4 casos, algunos con "multa" en contexto correcto) ──
const transitos = fichas.filter((f: any) => f.areaCorpus === "transito");
for (const f of transitos) {
  if (seleccionadas.filter(s => s.areaEsperada === "transito").length >= 4) break;
  const inst = f.institucion || "";

  if (/multa|infracci|tag/i.test(inst)) {
    agregar(f, "Tengo multas de tránsito acumuladas por más de $300.000 en el JPL de mi comuna. Las debo desde 2023 y me dijeron que me van a suspender la licencia. ¿Hay alguna forma de prescribir o negociar?");
  } else if (/licencia|conducir|suspensi/i.test(inst)) {
    agregar(f, "Me suspendieron la licencia de conducir por 3 meses por conducir con el TAG vencido. Necesito el auto para trabajar. ¿Puedo apelar esta medida?");
  } else if (/alcoholemia|ebriedad/i.test(inst)) {
    agregar(f, "Me hicieron un control de alcoholemia y dio positivo con 0.55 gramos. Me citaron al juzgado de policía local. ¿Qué sanción me pueden poner y puedo defenderme?");
  } else if (/accidente|colisi/i.test(inst)) {
    agregar(f, "Chocé contra un poste en la avenida y carabineros levantó acta de infracción por manejo imprudente. Ahora me llega la citación al juzgado de policía local. ¿Qué puedo hacer?");
  }
}

// ── FAMILIA (4 casos) ──
const familias = fichas.filter((f: any) => f.areaCorpus === "familia");
for (const f of familias) {
  if (seleccionadas.filter(s => s.areaEsperada === "familia").length >= 4) break;
  const inst = f.institucion || "";

  if (/alimento|pensión/i.test(inst)) {
    agregar(f, "El padre de mi hija no le paga la pensión de alimentos desde hace 5 meses. Ya fue citado a mediación pero no llegó. ¿Qué puedo hacer ahora?");
  } else if (/cuidado|tuici/i.test(inst)) {
    agregar(f, "Quiero pedir el cuidado personal de mi hijo de 7 años. La madre me lo niega sistemáticamente y tiene órdenes de restricción en mi contra por denuncias falsas.");
  } else if (/violencia intrafamiliar|VIF|protecci/i.test(inst)) {
    agregar(f, "Mi hermano me amenaza constantemente y me ha golpeado dos veces. Vive en la misma casa que yo. ¿Cómo obtengo una medida de protección?");
  } else if (/divorci/i.test(inst)) {
    agregar(f, "Quiero divorciarme de mi esposa después de 15 años de matrimonio. Tenemos dos hijos menores y 3 propiedades en común. No sabemos cómo empezar.");
  }
}

console.log(`\nTotal casos seleccionados: ${seleccionadas.length}`);
const porArea: Record<string, number> = {};
for (const s of seleccionadas) porArea[s.areaEsperada] = (porArea[s.areaEsperada] || 0) + 1;
console.log("Por área:", JSON.stringify(porArea));

// Guardar
fs.mkdirSync("evaluation/evaluacion-ciega-v2", { recursive: true });
fs.writeFileSync("evaluation/evaluacion-ciega-v2/casos-referencia.json", JSON.stringify(seleccionadas, null, 2));
console.log(`Guardados en evaluation/evaluacion-ciega-v2/casos-referencia.json`);

// Mostrar los relatos
for (const s of seleccionadas) {
  console.log(`\n${s.id} [${s.areaEsperada}] ${s.institucion?.slice(0, 60)}`);
  console.log(`  relato: ${s.relato.slice(0, 140)}`);
}
