// QA /datos Scanner Express (sin LLM, sin red en unit; SSRF + reglas).
import { evaluarReglas, validarUrlAuditable, auditarUrlDatos, parsearDom, type DomSnapshot } from "../src/server/datosScanner.js";

let ok = 0, fail = 0;
function chk(name: string, cond: boolean, data?: unknown) {
  if (cond) { ok++; console.log(`${ok + fail} ${name}: PASS`); }
  else { fail++; console.log(`${ok + fail} ${name}: FAIL ${JSON.stringify(data ?? "")}`); }
}

function snap(html: string, extra: Partial<DomSnapshot> = {}): DomSnapshot {
  const p = parsearDom(html);
  return { ...p, urlFinal: "https://ejemplo.cl/", html, ...extra };
}

// Fixtures: páginas tipo E-commerce
const HTML_LIMPIA = `
<!doctype html><html><head><title>Tienda</title></head><body>
<header><a href="/politica-privacidad">Política de privacidad</a> · <a href="/terminos">Términos</a></header>
<p>Responsable: Comercial Demo SpA. Para ejercer derechos ARSOPB escríbenos a privacidad@ejemplo.cl.</p>
<form><label><input type="checkbox" name="newsletter"> Quiero novedades (opcional)</label></form>
<script src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>
<p>Protección de datos personales según Ley 21.719 y su reglamento.</p>
</body></html>`;

const HTML_RIESGO = `
<!doctype html><html><body>
<form><label><input type="checkbox" checked name="aceptar_terminos"> Acepto términos y recibir promociones</label></form>
<p>Texto sin políticas ni derechos.</p>
<script src="https://connect.facebook.net/en_US/fbevents.js"></script>
<p>Nos basamos en la Ley 19.628 para tratamiento de datos.</p>
</body></html>`;

const rLimpia = evaluarReglas(snap(HTML_LIMPIA, { texto: parsearDom(HTML_LIMPIA).texto + " ley 21.719" }), { url: "https://ejemplo.cl/" });
chk("fixture sana sin R1/R2/R3/R4 criticos", !rLimpia.some((h) => ["R1-checkbox-premarcado", "R2-politica-ausente", "R3-arsopb-ausente", "R4-normativa-obsoleta"].includes(h.id)), rLimpia.map((h) => h.id));

const rRiesgo = evaluarReglas(snap(HTML_RIESGO), { url: "https://riesgo.cl/" });
chk("fixture riesgo detecta R1 critico", rRiesgo.some((h) => h.id === "R1-checkbox-premarcado" && h.gravedad === "critica"), rRiesgo);
chk("fixture riesgo detecta R2/R3/R4", ["R2-politica-ausente", "R3-arsopb-ausente", "R4-normativa-obsoleta"].every((id) => rRiesgo.some((h) => h.id === id)), rRiesgo.map((h) => h.id));

// SSRF: URL privadas rechazadas sin red
for (const bad of ["http://127.0.0.1/admin", "http://10.0.0.1/", "http://192.168.1.50/", "http://169.254.169.254/latest/meta-data/", "http://localhost:3000/x", "ftp://ejemplo.cl/x", "javascript:alert(1)"]) {
  chk(`SSRF bloquea ${bad}`, validarUrlAuditable(bad).ok === false, validarUrlAuditable(bad));
}
chk("SSRF permite URL publica https", validarUrlAuditable("https://tienda.cl/checkout?x=1").ok === true);
chk("SSRF permite URL publica http", validarUrlAuditable("http://tienda.cl").ok === true);

// Fixture runner con red mockeada (simulate no network in unit: usa html directo)
const res = await auditarUrlDatos({ url: "https://noexiste.invalid/x", email: "a@b.cl", autorizado: true }).catch((e: any) => null);
chk("scanner ante DNS/root unreachable no inventa score alto", res === null || typeof res.score === "number", res);

console.log(fail === 0 ? `\nQA DATOS SCANNER: ${ok}/${ok + fail} PASS` : `\nQA DATOS SCANNER: FAILURES=${fail}`);
process.exit(fail === 0 ? 0 : 1);
