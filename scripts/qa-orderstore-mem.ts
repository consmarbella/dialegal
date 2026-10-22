// QA Fase 2b: fallback en memoria cuando no hay DATABASE_URL ni DB activa.
// Debe avisar UNA vez y operar igual que antes.
delete process.env.DATABASE_URL;
const { saveOrder, getOrderByOrderId, getOrderByPreferenceId, updateOrder, consumeUseAtomic } = await import("../src/lib/orderStore.js");

const warn = console.warn;
let warns = 0;
console.warn = (...a: any[]) => { if (String(a[0] || "").includes("DATABASE_URL")) warns++; warn(...a); };

await saveOrder({ orderId: "ORD-MEM-1", preferenceId: "pref-MEM-1", status: "pending", amount: 19990, title: "Dictamen", createdAt: Date.now() });
const got = await getOrderByOrderId("ORD-MEM-1");
const got2 = await getOrderByOrderId("ORD-MEM-1");
const got3 = await getOrderByOrderId("ORD-MEM-1");
const upd = await updateOrder("ORD-MEM-1", { status: "approved", paidAt: 123 });
const c = await consumeUseAtomic("ORD-MEM-1"); // sin DB: ok:false (Fase 3 exigirá DB)
console.log(JSON.stringify({
  get: !!got && got.status === "pending" ? "PASS" : "FAIL",
  update: upd && upd.status === "approved" ? "PASS" : "FAIL",
  warnUnico: warns === 1 ? "PASS(warns=1)" : "FAIL(warns=" + warns + ")",
  preflight: got2 && got3 ? "PASS" : "FAIL",
  consumeSinDbBloqueado: !c.ok ? "PASS" : "FAIL",
}));
process.exit(0);
