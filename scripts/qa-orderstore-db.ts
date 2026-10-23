// QA Fase 2 (+ fix post-auditoria): orderStore contra Postgres local (docker pg-fase2-test).
// Idempotente: limpia las ordenes de prueba al inicio.
process.env.DATABASE_URL = "postgres://postgres:testonly@127.0.0.1:55432/postgres";
const { Pool } = await import("pg");
const cleanup = new Pool({ connectionString: process.env.DATABASE_URL });
await cleanup.query(`DELETE FROM orders WHERE order_id IN ('ORD-QA-FASE2-1','ORD-QA-HEAL-1')`);
await cleanup.end();

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

// Fix post-auditoria: re-save/curacion CON mpPaymentId/paidAt nuevos debe
// persistirlos (antes el ON CONFLICT los descartaba -> quedaban NULL en DB).
// Simula el "heal" de requirePaidOrder sobre una orden pendiente sin datos MP.
await saveOrder({
  orderId: "ORD-QA-HEAL-1", preferenceId: "pref-QA-HEAL-1", status: "pending",
  amount: 19990, title: "Dictamen", createdAt: Date.now(),
} as any);
const paidAt = Date.now();
await saveOrder({
  orderId: "ORD-QA-HEAL-1", preferenceId: "pref-QA-HEAL-1", status: "approved",
  amount: 19990, title: "Dictamen", mpPaymentId: "MP-777", paidAt, createdAt: Date.now(),
} as any);
const healed = await getOrderByOrderId("ORD-QA-HEAL-1");
console.log("7 heal persiste mp_payment_id/paid_at:", healed && healed.mpPaymentId === "MP-777" && healed.paidAt === paidAt && healed.status === "approved" ? "PASS" : "FAIL", JSON.stringify(healed));
// Y el re-save SIN datos MP (como /create re-usando orden) no los borra.
await saveOrder({
  orderId: "ORD-QA-HEAL-1", preferenceId: "pref-QA-HEAL-1", status: "approved",
  amount: 19990, title: "Dictamen", createdAt: Date.now(),
} as any);
const healed2 = await getOrderByOrderId("ORD-QA-HEAL-1");
console.log("8 resave sin datos MP conserva los previos:", healed2 && healed2.mpPaymentId === "MP-777" && healed2.paidAt === paidAt ? "PASS" : "FAIL", JSON.stringify(healed2));
// Limpieza de la orden del heal (la de usos queda como huella del QA).
const cleanup2 = new Pool({ connectionString: process.env.DATABASE_URL });
await cleanup2.query(`DELETE FROM orders WHERE order_id = 'ORD-QA-HEAL-1'`);
await cleanup2.end();
process.exit(0);
