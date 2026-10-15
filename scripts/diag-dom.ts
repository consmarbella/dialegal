import { chromium } from 'playwright';
import * as fs from 'fs';

// Diagnóstico: generar 1 caso y volcar el DOM real de la vista previa
async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.fill('textarea', 'S.J.L. del Trabajo de Santiago. Notificado el 13/10/2026 por despido injustificado art. 161. Demanda exige $6.500.000.');
  await page.click('button:has-text("Generar Diagnóstico Legal con IA Senior")');

  await page.waitForFunction(
    () => {
      const t = document.body.innerText;
      return t.includes('ALERTA DE URGENCIA') || t.includes('temporalmente saturado');
    },
    undefined,
    { timeout: 180000 }
  );

  const innerText = await page.innerText('body');
  const html = await page.content();

  const olItems = await page.$$eval('ol li span.flex-1', (nodes) =>
    nodes.map((n) => (n.textContent || '').trim())
  );

  const bodyLower = innerText.toLowerCase();
  const checks = {
    tieneAlertaUrgencia: innerText.includes('ALERTA DE URGENCIA'),
    tieneCardTitulo: innerText.includes('ALERTA DE URGENCIA'),
    tienePlazoFatalEnCurso: innerText.includes('Plazo Fatal en Curso'),
    tieneEstimado: innerText.includes('Estimado'),
    tieneFechaExacta: innerText.includes('Fecha Exacta de Vencimiento'),
    tieneFechaExactaCi: bodyLower.includes('fecha exacta de vencimiento'),
    tienePasosDefensa: innerText.includes('Pasos de Defensa'),
    tienePasosDefensaCi: bodyLower.includes('pasos de defensa'),
    tieneVistaPrevia: innerText.includes('VISTA PREVIA'),
    tieneSello: innerText.includes('ALERTAS DE URGENCIA'),
  };

  const out = { checks, olItems, innerTextLen: innerText.length, innerText: innerText.slice(0, 4000) };
  fs.writeFileSync('dom-diagnostico.json', JSON.stringify(out, null, 2));
  console.log('OK - ver dom-diagnostico.json');
  console.log('CHECKS:', JSON.stringify(checks, null, 2));
  console.log('OL ITEMS (' + olItems.length + '):', olItems.slice(0, 6));

  await browser.close();
}

main().catch((e) => { console.error('ERR', String(e).slice(0, 300)); process.exit(1); });
