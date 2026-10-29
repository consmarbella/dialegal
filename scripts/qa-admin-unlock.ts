// QA admin-unlock: e2e local del desbloqueo de cortesia del dueño.
// Requiere: servidor tsx corriendo en :3210 con ADMIN_UNLOCK_CODE=<codigo dueño>
// y PREMIUM_GROUNDING_ENABLED=true. Sin DATABASE_URL local, orderStore cae a
// memoria (degradacion documentada DECISIONES.md F3.3): los usos NO se cuentan
// (usosRestantes null); el conteo atomico con DB ya esta cubierto por
// qa-orderstore-db.ts y qa-paywall-fase3.ts.
const BASE = "http://localhost:3210";
const CODE = process.env.ADMIN_UNLOCK_CODE || "";
if (!CODE) {
  console.error("FAIL: ADMIN_UNLOCK_CODE no definida en el proceso del QA");
  process.exit(1);
}

function callApi(path: string, body: unknown) {
  return fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => ({ code: r.status, json: await r.json().catch(() => null) }));
}

const userStory =
  "Trabajador despedido el 10-03-2025 con carta de art. 161 necesidades de empresa. " +
  "Contrato de 20 meses, remuneracion $600.000. No le pagaron feriedades proporcionales.";

// (1) codigo incorrecto -> 401 generico
let r = await callApi("/api/payment/admin-unlock", { code: "9999" });
console.log("1 codigo incorrecto (espera 401):", r.code === 401 ? "PASS" : "FAIL", "->", r.code, JSON.stringify(r.json && r.json.error));

// (2) sin codigo -> 401
r = await callApi("/api/payment/admin-unlock", {});
console.log("2 sin codigo (espera 401):", r.code === 401 ? "PASS" : "FAIL", "->", r.code);

// (3) codigo correcto -> 200 con orderId ADMIN-*
r = await callApi("/api/payment/admin-unlock", { code: CODE });
const adminOk = r.code === 200 && r.json && r.json.ok === true && typeof r.json.orderId === "string" && r.json.orderId.startsWith("ADMIN-");
const adminOrderId = adminOk ? String(r.json.orderId) : "";
console.log("3 codigo correcto (espera 200, orderId ADMIN-*):", adminOk ? "PASS" : "FAIL", "->", r.code, adminOrderId ? "(orderId creado)" : JSON.stringify(r.json));

// (4) paywall intacto: premium-report sin orderId sigue en 400
r = await callApi("/api/premium-report", { userStory });
console.log("4 premium sin orderId (espera 400):", r.code === 400 ? "PASS" : "FAIL", "->", r.code);

// (5) e2e real: premium-report con el orderId de cortesia -> generacion premium
if (!adminOk) { console.error("FALLO: sin orden de cortesia no se puede probar e2e"); process.exit(1); }
const t0 = Date.now();
r = await callApi("/api/premium-report", { userStory, orderId: adminOrderId });
const ok5 = r.code === 200 && r.json && typeof r.json.report === "string" && r.json.report.length > 1000;
console.log(
  "5 premium con orden de cortesia (espera 200 real):", ok5 ? "PASS" : "FAIL",
  "->", r.code, `(${Date.now() - t0}ms)`,
  "reportChars=", r.json && r.json.report ? String(r.json.report).length : 0,
  "grounded=", r.json && r.json.grounded,
  "usosRestantes=", r.json && r.json.usosRestantes, "(null = memoria, degradacion F3.3)"
);

process.exit(ok5 && adminOk && r.code === 200 ? 0 : 1);
