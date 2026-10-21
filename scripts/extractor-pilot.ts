// Piloto del extractor determinista (sin IA): valida secciones, pares
// norma+articulo, artefactos y acciones sobre una demanda laboral sintetica.
// Uso: npx tsx scripts/extractor-pilot.ts
import { extraerChileno, planoBlindajePrompt } from "../extractorChile.js";

const demanda = `
EN LO PRINCIPAL: DEMANDA DE DESPIDO INJUSTIFICADO Y COBRO DE PRESTACIONES
S.J.L. DEL TRABAJO DE SANTIAGO

RODRIGO PEREZ SOTO, RUT 12.345.678-9, trabajador de la empresa CONSTRUCTORA ANDES LTDA., con domicilio en Av. Libertador 1234, comuna de Santiago, a US. respetuosamente digo:

ANTECEDENTES DE HECHO

PRIMERO: Con fecha 15 de marzo de 2024 fui contratado bajo contrato indefinido, desempeñandome como jefe de obra, con una remuneracion mensual de $1.850.000 (un millon ochocientos cincuenta mil pesos).

SEGUNDO: El 02 de septiembre de 2026, mediante carta de aviso, la demandada puso termino a mi contrato invocando la causal del articulo 161 del Codigo del Trabajo, esto es, necesidades de la empresa. Sin embargo, la carta solo senala "reestructuracion interna" y no expresa hechos concretos que justifiquen la medida.

TERCERO: La demandada adeuda las cotizaciones previsionales de los meses de junio, julio y agosto de 2026, lo que configura la nulidad del despido del articulo 162 del Codigo del Trabajo.

CUARTO: Durante mi empleo fui objeto de hostigamiento por mi supervisor, configurando acoso laboral y vulneracion de derechos fundamentales, solicitando tutela laboral conforme al articulo 485 del Codigo del Trabajo y la Ley 21.643 (Ley Karin).

EL DERECHO

Los hechos descritos configuran la causal de despido injustificado de los articulos 161 y 168 del Codigo del Trabajo, la nulidad del despido del articulo 162, y la vulneracion de derechos fundamentales de los articulos 485 y 486 del mismo cuerpo legal. Asimismo, se invoca el articulo 19 N 1 de la Constitucion y la Ley 19.728 sobre seguro de cesantia.

POR TANTO,

RUEGO A US. tener por interpuesta demanda de despido injustificado, nulidad del despido, tutela de derechos fundamentales y cobro de prestaciones, en contra de CONSTRUCTORA ANDES LTDA., y en definitiva declarar la injustificacion del despido, condenar al pago de las indemnizaciones de los articulos 162, 163 y 168 del Codigo del Trabajo, mas el recargo del 50%, las cotizaciones adeudadas y el dano moral, con costas.
`;

const ext = extraerChileno(demanda);
console.log("longitud:", ext.longitudEntrada);
console.log("acciones:", ext.acciones);
console.log("juzgado:", ext.juzgado);
console.log("normas:", ext.normasDetectadas.map((n) => n.nombre).join(" | "));
console.log("articulos:", ext.articulosInvocados.join(", "));
console.log("montos:", ext.montos);
console.log("fechas:", ext.fechas);
console.log("rut:", ext.rut);
console.log("secciones => hechos:", ext.secciones.hechos.length, "derecho:", ext.secciones.derecho.length, "petitorio:", ext.secciones.petitorio.length);
console.log("\n--- PLANO ---\n" + planoBlindajePrompt(ext));
