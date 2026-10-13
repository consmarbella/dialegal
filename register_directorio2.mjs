import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const email = 'xaos27@gmail.com';
  const pass = 'LegalHelp2026!';
  
  console.log('Opening DirectorioEmpresasChile crear cuenta...');
  await page.goto('https://www.directorioempresaschile.cl/crear-cuenta/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'directorio2_before.png', fullPage: true });
  console.log('Before screenshot');
  
  // Try to find form fields
  // Look for username/email/password fields
  const html = await page.content();
  console.log('Page contains crear cuenta?', html.includes('Crear') || html.includes('crear'));
  
  // Try to fill - inspect fields
  const inputs = await page.locator('input').all();
  console.log('Inputs found:', inputs.length);
  for (let i=0; i<Math.min(inputs.length, 10); i++) {
    try {
      const el = inputs[i];
      const type = await el.getAttribute('type');
      const name = await el.getAttribute('name');
      const id = await el.getAttribute('id');
      const placeholder = await el.getAttribute('placeholder');
      console.log(`Input ${i}: type=${type} name=${name} id=${id} placeholder=${placeholder}`);
    } catch {}
  }
  
  await page.waitForTimeout(5000);
  await browser.close();
}
run().catch(e=>{console.error(e); process.exit(1)});
