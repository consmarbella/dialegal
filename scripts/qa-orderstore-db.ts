// QA Fase 2: orderStore contra Postgres local (contenedor docker pg-fase2-test).
process.env.DATABASE_URL = "postgres://postgres:testonly@127.0.0.1:55432/postgres";
const { saveOrder, getOrderByOrderId, getOrderByPreferenceId, updateOrder, consumeUseAtomic } = await import("../src/lib/orderStore.js");

const orderId = "ORD-QA-FASE2-1";
await saveOrder({ orderId, preferenceId: "pref-QA-FASE2-1", status: "pending", amount: 19990, title: "Dictamen", createdAt: Date.now() });
const saved = await getOrderByOrderId(orderId);
console.log("1 save+get:", saved && saved.status === "pending" && saved.usos === 0 ? "PASS" : "FAIL", JSON.stringify(saved));

// update no permitido si no approved
let c = await consumeUseAtomic(orderId);
console.log("2 consume con orden pendiente:", !c.ok ? "PASS" : "FAIL", JSON.stringify(c));
await updateOrder(orderId, { status: "approved", mpPaymentId: "999", paidAt: Date.now() });
const upd = await getOrderByOrderId(orderId);
console.log("3 updateOrder:", upd && upd.status === "approved" && upd.mpPaymentId === "999" ? "PASS" : "FAIL", JSON.stringify(upd));
// Contador atómico: 4 consumos seguidos, deben salir solo 3 (límite por orden).
const r4 = [];
for (let i = 0; i < 4; i++) r4.push(await consumeUseAtomic(orderId));
console.log("4 consume x4 (deben pasar 3):", r4.filter((r) => r.ok).length === 3 ? "PASS" : "FAIL", JSON.stringify(r4.map((r) => ({ ok: r.ok, usos: r.usos }))));
// pref lookup
const byPref = await getOrderByPreferenceId("pref-QA-FASE2-1");
console.log("5 getOrderByPreferenceId:", byPref && byPref.orderId === orderId ? "PASS" : "FAIL");
// Re-save de la misma orden: no debe pisar usos (queda 3) ni paid_at.
await saveOrder({ orderId, preferenceId: "pref-QA-FASE2-1", status: "pending", amount: 19990, title: "Dictamen", createdAt: Date.now() });
const afterResave = await getOrderByOrderId(orderId);
console.log("6 resave conserva usos=3:", afterResave && afterResave.usos === 3 ? "PASS(usos=3)" : "FAIL(estado:" + afterResave.usos + ")");
process.exit(0);
