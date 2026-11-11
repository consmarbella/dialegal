// smoke-diagnosticos.ts — prueba REAL de los tres diagnósticos con el caso
// real del dueño (demanda de construcción):
//   1. GRATUITO  /api/analyze        → materia civil pura + pie BCN verificable
//   2. BORRADOR  /api/legalhelp/draft → contestación con materia civil + BCN
//   3. PAGADO    /api/premium-report  → 4 secciones + verificación BCN (vía
//      admin-unlock: orden de cortesía del dueño, sin MercadoPago)
//
// Uso: npx tsx scripts/smoke-diagnosticos.ts   (SMOKE_BASE para apuntar a prod)
import "dotenv/config";

const BASE = process.env.SMOKE_BASE || "http://localhost:3001";
const ADMIN_CODE = process.env.ADMIN_UNLOCK_CODE || "4321";

const CASO_REAL = `Con fecha 15 de marzo de 2025, celebró un contrato de ejecución de obra a suma alzada con la demandada para la construcción de una nave industrial y dependencias corporativas en la comuna de Lampa. El plazo de entrega se fijó en 180 días corridos, bajo apercibimiento de una multa contractual de 50 UF por cada día de atraso. La obra presentaba un avance real de apenas un 62%, abandonando la demandada los trabajos el 30 de septiembre de 2025. Asimismo, peritajes técnicos posteriores constataron fallas estructurales graves en los radieres y techumbre derivados de la negligencia en la supervisión de los subcontratistas contratados por la constructora. Responsabilidad Contractual: La demandada ha incurrido en un incumplimiento grave de las obligaciones estipuladas en los artículos 1545 y 1556 del Código Civil, al no entregar la obra en el plazo convenido y presentar vicios constructivos. Responsabilidad por el Hecho del Dependiente: Conforme al artículo 2320 del Código Civil, la constructora responde directamente por las negligencias de sus subcontratistas y personal en obra. Daño Emergente: $85.000.000.- por concepto de reparaciones estructurales y término de obra con un tercero. Lucro Cesante: $42.000.000.- por rentas de arrendamiento no percibidas durante los meses de paralización. Multa Contractual: 1.500 UF acumuladas a la fecha.`;

const fallos: string[] = [];
const check = (ok: boolean, msg: string, detalle?: string) => {
  console.log(`  ${ok ? "✅" : "❌"} ${msg}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos.push(msg + (detalle ? ` (${detalle})` : ""));
};

async function main() {
  console.log(`\n=== LOS TRES DIAGNÓSTICOS contra ${BASE} ===\n`);

  // ── 1. GRATUITO ────────────────────────────────────────────────────────────
  console.log("── 1. DIAGNÓSTICO GRATUITO (/api/analyze) ──");
  {
    const res = await fetch(`${BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userStory: CASO_REAL, documentText: "", notificationDate: "", audience: "abogado" }),
    });
    if (!res.ok) { check(false, `HTTP ${res.status}`, (await res.text()).slice(0, 200)); }
    else {
      const d = await res.json();
      const a: string = d.analysis || "";
      check(d.materiaSlug === "civil", "materia civil", `obtuvo ${d.materiaSlug}`);
      check(!d.materiaSecundaria, "sin secundaria fantasma", `secundaria=${d.materiaSecundaria}`);
      check((a.match(/\[VERIFICAR\]/g) || []).length > 0, "marcas [VERIFICAR] en citas");
      check(/## Verificación de citas — Ley Chile/.test(a), "pie de verificación BCN presente");
      check(!!d.bcn && Array.isArray(d.bcn.citados) && d.bcn.citados.length >= 1,
        "BCN verificó artículos citados", d.bcn?.citados?.map((c: any) => `${c.nombreNorma} Art. ${c.articulo}`).join(" | ") || "sin citados");
      check(!/tr[aá]nsito|monitorio/i.test(a), "sin tránsito/monitorio en el texto");
    }
  }

  // ── 2. BORRADOR ────────────────────────────────────────────────────────────
  console.log("\n── 2. BORRADOR (/api/legalhelp/draft, contestación) ──");
  {
    const res = await fetch(`${BASE}/api/legalhelp/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "contestacion",
        postura: "demandado",
        hechos: CASO_REAL,
        pretensiones: [
          "Rechazar la demanda en todas sus partes por haberse cumplido el contrato",
          "Rechazar la multa contractual por improcedente y desproporcionada",
        ],
        documentoCaso: CASO_REAL,
        tribunal: "Juzgado de Letras en lo Civil de Colina",
        audience: "abogado",
      }),
    });
    if (!res.ok) { check(false, `HTTP ${res.status}`, (await res.text()).slice(0, 200)); }
    else {
      const d = await res.json();
      const draft: string = d.draft || "";
      check(draft.length > 3000, "borrador con contenido", `${draft.length} chars`);
      check(!/tr[aá]nsito|juzgado de polic/i.test(draft), "borrador sin contaminación de tránsito");
      check(!!d.bcn && Array.isArray(d.bcn.citados), "BCN del borrador presente",
        d.bcn?.citados?.slice(0, 4).map((c: any) => `${c.nombreNorma} Art. ${c.articulo}`).join(" | ") || "sin citados");
      const criticos = (d.tactico || []).filter((t: any) => /graves?|critico|critico/i.test(String(t.severidad || t.id || "")));
      check(!criticos.length, "sin hallazgos tácticos críticos", `hallazgos: ${(d.tactico || []).length}`);
      check(/EN LO PRINCIPAL|CONTESTACI|VISTOS/i.test(draft), "estructura de escrito judicial");
    }
  }

  // ── 3. PAGADO (vía admin-unlock, orden de cortesía del dueño) ─────────────
  console.log("\n── 3. DIAGNÓSTICO PAGADO (/api/premium-report vía admin-unlock) ──");
  {
    const unlockRes = await fetch(`${BASE}/api/payment/admin-unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: ADMIN_CODE }),
    });
    const unlockData = await unlockRes.json().catch(() => null);
    if (!unlockRes.ok || !unlockData?.orderId) {
      check(false, "admin-unlock no aprobó la orden de cortesía", `${unlockRes.status}: ${JSON.stringify(unlockData).slice(0, 150)}`);
    } else {
      console.log(`  (orden de cortesía: ${unlockData.orderId})`);
      const res = await fetch(`${BASE}/api/premium-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: unlockData.orderId,
          userStory: CASO_REAL,
          documentText: "",
          notificationDate: "",
          area: null,
        }),
      });
      if (!res.ok) { check(false, `HTTP ${res.status}`, (await res.text()).slice(0, 200)); }
      else {
        const d = await res.json();
        const r: string = d.report || "";
        check(r.length > 2000, "informe premium con contenido", `${r.length} chars`);
        check(/## 1\. Criterio Jurisprudencial/.test(r), "sección 1 (criterio jurisprudencial)");
        check(/## 2\. Control de Nulidades/.test(r), "sección 2 (nulidades y puntos ciegos)");
        check(/## 3\. Verificaci[oó]n de Art[ií]culos/.test(r), "sección 3 (verificación de artículos)");
        check(/## 4\. Fuentes Consultadas/.test(r), "sección 4 (fuentes)");
        check(d.materia === "Civil" || d.materiaSlug === "civil", "materia premium civil", `obtuvo ${d.materia || d.materiaSlug}`);
        check(!d.materiaSecundaria, "premium sin secundaria fantasma", `secundaria=${d.materiaSecundaria}`);
        check(!!d.bcn && d.bcn.citados.length >= 1, "BCN verificó artículos del informe",
          d.bcn?.citados?.slice(0, 5).map((c: any) => `${c.nombreNorma} Art. ${c.articulo}`).join(" | ") || "sin citados");
        check(!/tr[aá]nsito y juzgado|monitorio de arrendamiento/i.test(r), "sin tránsito/monitorio en premium");
      }
    }
  }

  console.log("\n=== RESULTADO ===");
  if (fallos.length) {
    console.error(`❌ ${fallos.length} fallo(s):\n- ${fallos.join("\n- ")}`);
    process.exit(1);
  }
  console.log("✅ LOS TRES DIAGNÓSTICOS OK");
}
main().catch((e) => { console.error(e); process.exit(1); });
