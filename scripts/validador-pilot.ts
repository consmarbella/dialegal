// Piloto del validador post-salida (QA determinista): un informe con roles
// validos, un rol inventado, articulos BCN y un monto no corroborado.
import { validarInforme, notaBlindajeReporte } from "../validadorInforme.js";

const informe = `
## 1. Criterio Jurisprudencial Dominante y Estrategia Procesal
El criterio de la Cuarta Sala se contiene en el Rol N° 28321-2021 y en el rol 9043-2020.
También se cita el Rol N° 99999-2030, que no existe en el corpus.

## 3. Verificación de Artículos y Plazos Citados
- Art. 161 del Código del Trabajo: verificado.
- Art. 162: verificado.
- Art. 777 del Código de Procedimiento Civil: revisar.
El monto adeudado asciende a $1.850.000 y los recargos a $5.500.000.
`;

const v = validarInforme(informe, {
  rolesCorpus: ["28321-2021", "9043-2020", "45.123-2021"],
  artsCubiertos: ["161", "162"],
  artsPendientes: ["777"],
  montosDoc: ["1.850.000"],
  textoDoc: "remuneracion mensual de $1.850.000",
});

console.log(JSON.stringify({
  rolesInforme: v.rolesInforme,
  rolesEnCorpus: v.rolesEnCorpus,
  rolesNoEnCorpus: v.rolesNoEnCorpus,
  artsInforme: v.artsInforme,
  artsCubiertos: v.artsCubiertos,
  artsSinCobertura: v.artsSinCobertura,
  montosNoCorroborados: v.montosNoCorroborados,
  correcciones: v.correcciones,
}, null, 2));
console.log("\n--- NOTA ---\n" + notaBlindajeReporte(v));
