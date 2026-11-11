// Auditoría ciega v2: relatos únicos y complejos, comparación profunda.
// Los relatos son ESCRITOS A MANO (no generados por matching automático)
// para asegurar variedad y que puedan disparar señales equivocadas.

import fs from "fs";
import path from "path";

// Los 17 casos con relatos únicos escritos a mano
// Cada relato está diseñado para:
// 1. No revelar la respuesta esperada
// 2. Ser suficientemente complejo para disparar señales múltiples
// 3. Algunos contienen palabras trampa ("multa", "contrata", "arrendamiento") fuera de contexto
// 4. Ser en lenguaje real de persona, no lenguaje jurídico

const CASOS = [
  // ── LABORAL (4 casos) ──
  {
    id: "A001",
    areaEsperada: "laboral",
    areaSecundariaEsperada: null,
    institucion: "Principio de Primacía de la Realidad",
    falloRector: "33102-2019",
    normasEsperadas: ["Código del Trabajo, Art. 7", "Código del Trabajo, Art. 8"],
    relato: "Contraté con una empresa de software para hacer consultoría independiente. Firmé una boleta de honorarios cada mes. Pero en la práctica llego todos los días de 9 a 6 a la oficina, uso su computador, me reporto a un jefe que me da instrucciones sobre qué desarrollar y me evalúa trimestralmente como a los demás empleados. Ahora me dijeron que no van a renovar el proyecto y me piden que entregue el equipo mañana. ¿Tengo algún derecho?",
  },
  {
    id: "A002",
    areaEsperada: "laboral",
    areaSecundariaEsperada: null,
    institucion: "Terminación por Necesidades de la Empresa (Art. 161 CT)",
    falloRector: "28321-2021",
    normasEsperadas: ["Código del Trabajo, Art. 161", "Código del Trabajo, Art. 168", "Ley N° 19.728, Art. 13"],
    relato: "Mi empresa me despidió el pasado lunes invocando necesidades de la empresa. Trabajé ahí 5 años y no me pagaron la indemnización completa. Además descubrí que las cotizaciones de AFP de los últimos 3 meses no fueron enteradas. ¿Qué opciones tengo?",
  },
  {
    id: "A003",
    areaEsperada: "laboral",
    areaSecundariaEsperada: null,
    institucion: "Procedimiento de Tutela Laboral y Derechos Fundamentales (Art. 485 CT)",
    falloRector: null,
    normasEsperadas: ["Código del Trabajo, Art. 485", "Código del Trabajo, Art. 486"],
    relato: "En la empresa donde trabajo el supervisor revisa mis correos personales, me exige que le comparta mi ubicación por teléfono fuera del horario laboral y me amenazó con despedirme si presentaba una denuncia interna sobre irregularidades en los pagos. ¿Qué pasos legales puedo seguir?",
  },
  {
    id: "A004",
    areaEsperada: "laboral",
    areaSecundariaEsperada: null,
    institucion: "Cotizaciones previsionales impagas",
    falloRector: null,
    normasEsperadas: ["Código del Trabajo, Art. 162"],
    relato: "Descubrí que mi empresa no pagó mis cotizaciones de AFP durante 6 meses. Me enteré cuando fui a pedir un crédito al banco y me lo rechazaron por mora previsional. ¿Qué consecuencias tiene eso para mi empleador y qué puedo hacer?",
  },
  // ── CIVILES (10 casos, algunos con palabras trampa) ──
  {
    id: "A005",
    areaEsperada: "civil",
    areaSecundariaEsperada: null,
    institucion: "Indemnización de Perjuicios y Cláusula Penal (Art. 1535 CC)",
    falloRector: "22140-2019",
    normasEsperadas: ["Código Civil, Art. 1535", "Código Civil, Art. 1542", "Código Civil, Art. 1544", "Código Civil, Art. 1556"],
    relato: "Firmé un contrato de construcción con una constructora para una nave industrial de $200 millones. El contrato incluye una multa de 1500 UF por cada día de atraso en la entrega. La obra se atrasó 3 meses y ahora me exigen $135.000.000 solo en multas, más el resto del contrato. ¿La multa es proporcional al contrato o puedo pedir que la reduzcan?",
    // TRAMPA: "multa" pero es cláusula penal de construcción, NO tránsito
  },
  {
    id: "A006",
    areaEsperada: "civil",
    areaSecundariaEsperada: null,
    institucion: "La Mora del Deudor y la Excepción de Contrato No Cumplido",
    falloRector: "35890-2017",
    normasEsperadas: ["Código Civil, Art. 1551", "Código Civil, Art. 1552", "Código de Procedimiento Civil, Art. 309"],
    relato: "Contraté con una empresa de eventos para mi matrimonio. Pagué $2.000.000 de anticipo y se declararon en quiebra una semana antes del evento. No me devolvieron la plata ni me prestaron el servicio. ¿Puedo recuperar mi dinero?",
  },
  {
    id: "A007",
    areaEsperada: "civil",
    areaSecundariaEsperada: null,
    institucion: "Prescripción Extintiva o Liberatoria (Arts. 2514 CC)",
    falloRector: null,
    normasEsperadas: ["Código Civil, Art. 2514", "Código Civil, Art. 2523"],
    relato: "Banco Santander me cobró una deuda de una tarjeta de crédito que no pago desde marzo de 2018. Me llegó una carta de abogados amenazando con demandarme. ¿Todavía pueden demandarme o ya pasó el tiempo?",
  },
  {
    id: "A008",
    areaEsperada: "civil",
    areaSecundariaEsperada: null,
    institucion: "Presunción de Culpa por el Hecho Ajeno (Art. 2320 CC)",
    falloRector: "21340-2019",
    normasEsperadas: ["Código Civil, Art. 2320", "Código Civil, Art. 2322"],
    relato: "La empresa constructora que contraté para arreglar mi casa dejó una viga mal instalada que colapsó y dañó el auto de mi vecino que estaba estacionado delante. El vecino me está demandando a mí por los daños del auto, no a la constructora. ¿Puedo transferirle la responsabilidad a la constructora?",
  },
  {
    id: "A009",
    areaEsperada: "civil",
    areaSecundariaEsperada: null,
    institucion: "Cumplimiento Forzado de las Obligaciones",
    falloRector: "12430-2020",
    normasEsperadas: ["Código Civil, Art. 1548", "Código Civil, Art. 1553", "Código Civil, Art. 1555"],
    relato: "Contraté con una empresa de transporte para mover mi maquinaria industrial de Santiago a Concepción. No llegaron a la fecha pactada y cuando llegó la maquinaria estaba dañada. Tengo un contrato firmado con las condiciones de entrega y fotos de los daños. ¿Qué puedo hacer?",
  },
  {
    id: "A010",
    areaEsperada: "civil",
    areaSecundariaEsperada: null,
    institucion: "Comunidad de Bienes (Copropiedad)",
    falloRector: null,
    normasEsperadas: ["Código Civil, Art. 2305"],
    relato: "Heredé un terreno junto con mis 3 hermanos. Uno de ellos lo ocupa y lo explota comercialmente como estacionamiento sin pagarme nada ni pedirme permiso. Quiero saber si puedo vender mi porción sin su consentimiento o si necesito dividir primero.",
  },
  {
    id: "A011",
    areaEsperada: "civil",
    areaSecundariaEsperada: null,
    institucion: "Compraventa con vicios ocultos",
    falloRector: null,
    normasEsperadas: ["Código Civil, Art. 1854", "Código Civil, Art. 1858"],
    relato: "Compré un departamento nuevo directamente a la inmobiliaria y a los 6 meses aparecieron filtraciones en el techo y grietas estructurales en las paredes. La constructora dice que es asentamiento normal y que la garantía ya venció. ¿Tengo algún recurso legal o me quedé sin opciones?",
  },
  {
    id: "A012",
    areaEsperada: "civil",
    areaSecundariaEsperada: null,
    institucion: "Cobranza y morosidad",
    falloRector: null,
    normasEsperadas: ["Código Civil, Art. 2514"],
    relato: "Una empresa de cobranza me está llamando todos los días amenazando con embargarme el auto por una deuda de una tarjeta de crédito que no reconozco. Dicen que compraron mi deuda a un banco pero nunca me mostraron documentos. ¿Qué derechos tengo?",
    // TRAMPA: menciona "embargar" (podría confundir con ejecutivo) y "auto" (podría confundir con tránsito)
  },
  // ── TRÁNSITO (4 casos) ──
  {
    id: "A013",
    areaEsperada: "transito",
    areaSecundariaEsperada: null,
    institucion: "Ley 18.290 Art. 5 — DE LOS CONDUCTORES Y DE LAS LICENCIAS",
    falloRector: null,
    normasEsperadas: ["Ley N° 18.290, Art. 5", "Ley N° 18.287"],
    relato: "Me llegaron multas de tránsito acumuladas por más de $300.000 en el juzgado de policía local de mi comuna. Las debo desde 2023 y ahora me dicen que me van a suspender la licencia de conducir. ¿Hay alguna forma de prescribir o negociar estas multas?",
  },
  {
    id: "A014",
    areaEsperada: "transito",
    areaSecundariaEsperada: null,
    institucion: "Ley 18.290 Art. 6 — DE LOS CONDUCTORES",
    falloRector: null,
    normasEsperadas: ["Ley N° 18.290, Art. 6", "Ley N° 18.287"],
    relato: "Me suspendieron la licencia de conducir por 3 meses por conducir con el TAG vencido. Necesito el auto para trabajar. ¿Puedo apelar esta medida ante el juzgado de policía local?",
  },
  {
    id: "A015",
    areaEsperada: "transito",
    areaSecundariaEsperada: null,
    institucion: "Alcoholemia y JPL",
    falloRector: null,
    normasEsperadas: ["Ley N° 18.290", "Ley N° 18.287"],
    relato: "Me hicieron un control de alcoholemia en un retén y dio positivo con 0.55 gramos por litro. Me citaron al juzgado de policía local para la semana próxima. ¿Qué sanción me pueden poner y tengo alguna defensa?",
  },
  {
    id: "A016",
    areaEsperada: "transito",
    areaSecundariaEsperada: null,
    institucion: "Colisión y accidente de tránsito",
    falloRector: null,
    normasEsperadas: ["Ley N° 18.290", "Ley N° 18.287"],
    relato: "Chocé contra un poste en la avenida y carabineros levantó acta de infracción por manejo imprudente. Ahora me llega la citación al juzgado de policía local para declarar. ¿Qué puedo hacer y qué sanción me arriesgo?",
  },
];

console.log(`Total casos: ${CASOS.length}`);
const porArea: Record<string, number> = {};
for (const c of CASOS) porArea[c.areaEsperada] = (porArea[c.areaEsperada] || 0) + 1;
console.log("Por área:", JSON.stringify(porArea));

// Guardar
fs.mkdirSync("evaluation/evaluacion-ciega-v2", { recursive: true });
fs.writeFileSync("evaluation/evaluacion-ciega-v2/casos-referencia.json", JSON.stringify(CASOS, null, 2));
console.log("Guardados en evaluation/evaluacion-ciega-v2/casos-referencia.json");
