import fs from "fs";
import path from "path";

// Bajar criterios para familia y transito: solo contenido + normas, sin exigir falloRector
const files = ["laboral", "civil", "familia", "transito"];
const seleccion: any[] = [];

for (const f of files) {
  const p = path.join("data", "corpus-full", `${f}.json`);
  if (!fs.existsSync(p)) continue;
  const data = JSON.parse(fs.readFileSync(p, "utf-8"));
  const fichas = (data.fichas || []).filter((x: any) =>
    (x.contenido || "").length > 150 &&
    (x.normas || []).length > 0 &&
    (x.definicion || "").length > 50
  );
  console.log(`${f}: ${fichas.length} fichas con contenido+normas`);
  // Para laboral y civil priorizar con falloRector, luego sin
  const conRector = fichas.filter((x: any) => x.falloRector?.rol);
  const sinRector = fichas.filter((x: any) => !x.falloRector?.rol);
  const limite = f === "laboral" ? 10 : f === "civil" ? 8 : f === "familia" ? 4 : f === "transito" ? 4 : 0;
  const seleccionadas = [...conRector, ...sinRector].slice(0, limite);
  console.log(`  seleccionadas: ${seleccionadas.length} (con rector: ${conRector.length}, sin: ${sinRector.length})`);
  seleccion.push(...seleccionadas.map((x: any) => ({ ...x, areaCorpus: f })));
}

console.log(`\nTotal seleccionadas: ${seleccion.length}`);

// Ahora construir los relatos sintéticos en lenguaje de cliente
// REGLA ESTRICTA: No artículos, no doctrina, no consecuencias legales, no estrategia
// Solo: hechos, fechas, montos, partes anonimizadas, petición del usuario

const relatos = seleccion.map((f, i) => {
  const area = f.areaCorpus;
  const inst = f.institucion || "";

  // Extraer la "idea central" de la definición para construir el relato
  const def = (f.definicion || "").slice(0, 300);
  const contenido = (f.contenido || "").slice(0, 800);

  // Construir relato según área
  let relato = "";
  if (area === "laboral") {
    if (/despido|término|terminaci/i.test(inst + def)) {
      relato = "Mi empleador me despidió. Recibí una carta hace unos días pero no estoy de acuerdo con lo que dice. Trabajé ahí varios años y siento que no fue justo. ¿Qué puedo hacer?";
    } else if (/subordinaci|ius variandi|modific/i.test(inst + def)) {
      relato = "Mi jefe cambió mis funciones sin avisarme. Ahora me piden hacer cosas totalmente distintas a lo que contraté. No sé si tiene derecho a hacer eso.";
    } else if (/tutela|derechos fundament/i.test(inst + def)) {
      relato = "En mi trabajo mi supervisor me trata mal constantemente, me humilla delante de mis compañeros. Quiero saber si eso es legal y qué opciones tengo.";
    } else if (/acoso|hostigamiento|karin/i.test(inst + def)) {
      relato = "Un compañero de trabajo me manda mensajes ofensivos todos los días. Lo denuncié con el jefe pero no hizo nada. ¿Qué puedo hacer?";
    } else if (/horas extra|jornada|sobretiempo/i.test(inst + def)) {
      relato = "Trabajo hasta las 9 de la noche todos los días pero en mi liquidación solo aparecen 45 horas semanales. Creo que me deben plata por las horas adicionales.";
    } else if (/cotizaciones|previsional|afp/i.test(inst + def)) {
      relato = "Me di cuenta de que mi empleador no pagó las cotizaciones de los últimos meses. Necesito saber qué consecuencias tiene eso.";
    } else if (/contrata|subcontrata|mandante/i.test(inst + def)) {
      relato = "Trabajo como contratista en una empresa grande pero mi pago llega atrasado todos los meses. ¿Puedo cobrar directamente a la empresa principal?";
    } else if (/fuero maternal|maternidad|embarazo/i.test(inst + def)) {
      relato = "Estoy embarazada y mi jefe me cambió de funciones a algo mucho más simple. Creo que lo hizo porque estoy embarazada.";
    } else if (/antisindical|sindicato/i.test(inst + def)) {
      relato = "Quise formar un sindicato en mi empresa y el empleador me amenazó con despedirme. ¿Qué puedo hacer?";
    } else if (/primacía|realidad/i.test(inst + def)) {
      relato = "En mi contrato dice que soy independiente pero en la práctica mi jefe me controla horario, me da órdenes y me evalúa como a un empleado más.";
    } else if (/alivio probatorio|indicios/i.test(inst + def)) {
      relato = "Demandé a mi ex empleador pero no tengo pruebas directas de lo que me hizo, solo mensajes y correos que muestran cosas sospechosas. ¿Sirve eso?";
    } else if (/procedimiento|tutela/i.test(inst + def)) {
      relato = "Quiero reclamar porque mi empleador violó mis derechos fundamentales en el trabajo. Escuché que hay un procedimiento especial para eso.";
    } else {
      relato = "Tengo un problema con mi empleador relacionado con mi contrato de trabajo. No sé exactamente qué hacer ni qué derechos tengo.";
    }
  } else if (area === "civil") {
    if (/obligaci|contrato|incumplimien/i.test(inst + def)) {
      relato = "Le presté plata a una persona con un documento firmado y no me quiere pagar. Ya pasó más de un año y nada. ¿Qué puedo hacer?";
    } else if (/arrendamiento|arriendo|arrendador|arrendatario/i.test(inst + def)) {
      relato = "Mi arrendatario no paga la renta hace 3 meses y no quiere salir del inmueble. ¿Cómo puedo sacarlo?";
    } else if (/responsabi|daño|perjuicio/i.test(inst + def)) {
      relato = "Un auto chocó contra mi propiedad y el conductor se dio a la fuga. Tengo la patente y testigos. ¿Puedo reclamar?";
    } else if (/prescripci/i.test(inst + def)) {
      relato = "Tengo una deuda que no pago hace varios años y nadie me ha cobrado. ¿Sigue existiendo o ya no puedo ser demandado por eso?";
    } else if (/compraventa|venta/i.test(inst + def)) {
      relato = "Compré un auto a una persona y resulta que tiene gravámenes que no me dijo. ¿Puedo demandar?";
    } else if (/testamento|herencia|sucesi/i.test(inst + def)) {
      relato = "Mi papá falleció y hay un testamento pero sospecho que fue manipulado. Los hermanos no se ponen de acuerdo. ¿Qué puedo hacer?";
    } else if (/comunidad|condomini/i.test(inst + def)) {
      relato = "Tengo un terreno en común con mis hermanos y uno de ellos lo ocupa sin pagarme nada ni pedirme permiso. ¿Puedo vender mi parte?";
    } else if (/gasto|común|reparaci/i.test(inst + def)) {
      relato = "Vivo en un edificio donde los gastos comunes se cobran sin desglose. Pido la liquidación y no me la entregan. ¿Es legal?";
    } else {
      relato = "Tengo un problema civil con una persona sobre un tema de plata y contratos. No sé qué pasos seguir.";
    }
  } else if (area === "familia") {
    if (/alimento|pensión|alimenticia/i.test(inst + def)) {
      relato = "Necesito que el padre de mis hijos les pague pensión de alimentos. No me ayuda desde hace meses.";
    } else if (/cuidado|tuici|visita/i.test(inst + def)) {
      relato = "Quiero tener el cuidado personal de mi hijo. La mamá no permite que lo vea regularmente y hay un ambiente muy tenso.";
    } else if (/divorci|separaci/i.test(inst + def)) {
      relato = "Llevo años separado de mi pareja y quiero hacer el divorcio formal. No sabemos cómo repartir los bienes.";
    } else if (/violencia intrafamiliar|VIF/i.test(inst + def)) {
      relato = "Mi pareja me amenaza y me controla todo. Siento que no puedo hacer nada sin su permiso. ¿Qué opciones tengo?";
    } else {
      relato = "Tengo un problema familiar que necesita solución legal. No sé qué pasos seguir.";
    }
  } else if (area === "transito") {
    if (/multa|tag|infracci/i.test(inst + def)) {
      relato = "Me llegaron multas de tránsito de hace varios años que nunca pagué. Ahora me dicen que me van a embargar. ¿Hay alguna forma de resolver esto?";
    } else if (/licencia|conducir|suspensi/i.test(inst + def)) {
      relato = "Me suspendieron la licencia de conducir por acumulación de multas. Necesito conducir para trabajar. ¿Puedo apelar?";
    } else if (/accidente|colisión|choque/i.test(inst + def)) {
      relato = "Tuve un accidente de tránsito donde la otra persona se dio a la fuga. Denuncié en carabineros pero no pasa nada. ¿Qué puedo hacer?";
    } else if (/alcoholemia|ebriedad/i.test(inst + def)) {
      relato = "Me controlaron en un retén y me hicieron la prueba de alcohol. Ahora tengo una citación al juzgado de policía local. ¿Qué consecuencias tiene?";
    } else {
      relato = "Tengo un problema con una multa de tránsito o un tema en el juzgado de policía local. No sé qué hacer.";
    }
  } else {
    relato = "Tengo un problema legal que no sé cómo resolver.";
  }

  return {
    id: `E${String(i + 1).padStart(3, "0")}`,
    areaEsperada: area,
    institucion: inst.slice(0, 100),
    falloRector: f.falloRector?.rol || null,
    normasEsperadas: (f.normas || []).map((n: string) => n.replace("BCN - ", "")),
    relato,
    definicionOriginal: def,
    contenidoOriginal: contenido,
    operativaProcesal: f.operativaProcesal || "",
  };
});

// Guardar
fs.mkdirSync("evaluation/evaluacion-ciega", { recursive: true });
fs.writeFileSync("evaluation/evaluacion-ciega/casos-referencia.json", JSON.stringify(relatos, null, 2));
console.log(`\nGuardados ${relatos.length} casos`);
const porArea: Record<string, number> = {};
for (const r of relatos) porArea[r.areaEsperada] = (porArea[r.areaEsperada] || 0) + 1;
console.log("Por área:", JSON.stringify(porArea));
for (const r of relatos.slice(0, 8)) {
  console.log(`${r.id} [${r.areaEsperada}] ${r.institucion?.slice(0, 50)}`);
  console.log(`  relato: ${r.relato.slice(0, 120)}...`);
}
