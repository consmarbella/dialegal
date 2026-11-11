import fs from "fs";

const dump = JSON.parse(fs.readFileSync("../respaldo-produccion/dump_completo_legalhelp.json", "utf-8"));
const orders = dump.tablas.orders;

for (const o of orders) {
  let cd: any = {};
  try { cd = JSON.parse(o.case_data_json || "{}"); } catch {}
  const relato = cd.userStory || cd.user_story || cd.hechos || "";
  const pretensiones = cd.pretensiones || [];
  const docText = cd.documentText || cd.documento || "";
  console.log(`\n=== ${o.order_id.slice(0, 16)} | status=${o.status} | plan=${o.plan} ===`);
  console.log(`Relato (${relato.length} chars): ${relato.slice(0, 250)}`);
  if (pretensiones.length) console.log(`Pretensiones: ${JSON.stringify(pretensiones).slice(0, 150)}`);
  if (docText) console.log(`Documento: ${docText.slice(0, 100)}...`);
}
