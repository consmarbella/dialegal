// QA Fase 3: paywall server-side de /api/premium-report e2e local.
// Requiere: servidor tsx corriendo en :3210 con DATABASE_URL -> docker pg-fase2-test.
// Pasos: (1) sin orderId -> 400; (2) orden inexistente -> 402; (3) orden pendiente -> 402;
// (4) orden aprobada (UPDATE directo en la DB de QA) -> 200 + usos=1; (5)-(7) re-calls a
// caché con el mismo payload: usos 2 y 3 OK, el 4mo -> 402.
const PG = "postgres://postgres:testonly@127.0.0.1:55432/postgres";
const BASE = "http://localhost:3210";

function callApi(path, body) {
  return fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => ({ code: r.status, json: await r.json().catch(() => null) }));
}

const payload = {
  orderId: "",
  userStory: "Trabajador despedido en 2024. Contrato de quince meses. Adeudo: 3 meses de remuneracion $500.000 cada uno.",
};

const { Pool } = await import("pg");
const pool = new Pool({ connectionString: PG });

// (1) sin orderId
let r = await callApi("/api/premium-report", { userStory: payload.userStory });
console.log("1 sin orderId (espera 400):", r.code === 400 ? "PASS" : "FAIL", "->", r.code);

// crear orden pendiente por API real
const creacion = await fetch(BASE + "/api/payment/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto: "consultation de prueba qa fase 3" }) }).then((x) => x.json());
if (!creacion.orderId) { console.error("FAIL: no se pudo crear orden de prueba", creacion); process.exit(1); }
const orderId = creacion.orderId;
console.log("2 orden creada:", orderId);

// (3) orden pendiente -> 402
r = await callApi("/api/premium-report", { ...payload, orderId });
console.log("3 orden pendiente (espera 402):", r.code === 402 ? "PASS" : "FAIL", "->", r.code, JSON.stringify(r.json && r.json.usosRestantes));

// (4) aprobar directo en DB de QA y probar generación real
await pool.query("UPDATE orders SET status='approved', usos=0 WHERE order_id=$1", [orderId]);
const t0 = Date.now();
r = await callApi("/api/premium-report", { ...payload, orderId });
const ok4 = r.code === 200 && r.json && (r.json.usosRestantes === 2 || r.json.usosRestantes === null);
console.log("4 generado (espera 200, usosRestantes=2):", ok4 ? "PASS" : "FAIL", "->", r.code, `(${Date.now() - t0}ms)`, "usosRestantes=", r.json && r.json.usosRestantes, "| reportChars=", r.json && r.json.report ? String(r.json.report).length : 0);

// (5) reintento igual -> cache hit, usa el 2do uso
r = await callApi("/api/premium-report", { ...payload, orderId });
console.log("5 cache hit (200, usosRestantes=1):", r.code === 200 && r.json && r.json.cached === true && r.json.usosRestantes === 1 ? "PASS" : "FAIL", "->", r.code, "usosRestantes=", r.json && r.json.usosRestantes);

// (6) tercer uso
r = await callApi("/api/premium-report", { ...payload, orderId });
console.log("6 tercer uso (200, usosRestantes=0):", r.code === 200 && r.json && r.json.usosRestantes === 0 ? "PASS" : "FAIL", "->", r.code);

// (7) cuarto uso -> 402
r = await callApi("/api/premium-report", { ...payload, orderId });
console.log("7 cuarto uso (espera 402):", r.code === 402 ? "PASS" : "FAIL", "->", r.code);

const usos = await pool.query("SELECT usos, status FROM orders WHERE order_id=$1", [orderId]);
console.log("8 estado final en DB:", usos.rows[0]);
await pool.end();
process.exit(0);
