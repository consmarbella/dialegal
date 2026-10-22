// Regresion Fase 1: rol con base de rol (guiones/puntos) debe contar UNA vez.
import { validarInforme } from "../validadorInforme.js";

const informe = `Criterio en Rol N° 28.321-2021 y rol 9.043-2020.`;
const v = validarInforme(informe, {
  rolesCorpus: ["28321-2021", "9043-2020"],
  artsCubiertos: [],
  artsPendientes: [],
  montosDoc: [],
  textoDoc: "",
});

const ok = v.rolesEnCorpus.length === 2 && v.rolesNoEnCorpus.length === 0 && v.rolesInforme.length === 2;
console.log(JSON.stringify({
  rolesInforme: v.rolesInforme,
  rolesEnCorpus: v.rolesEnCorpus,
  rolesNoEnCorpus: v.rolesNoEnCorpus,
  correcciones: v.correcciones,
}, null, 2));
console.log(ok ? "PASS: sin doble conteo" : "FAIL: doble conteo");
process.exit(ok ? 0 : 1);
