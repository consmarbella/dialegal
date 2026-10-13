import { chromium } from 'playwright';

const email = 'xaos27@gmail.com';

async function selectOption(page, buttonText, optionText) {
  try {
    await page.evaluate(() => {
      document.querySelectorAll('iframe, ins.adsbygoogle').forEach(el => el.remove());
    });
    const btn = page.locator('button').filter({ hasText: buttonText }).first();
    await btn.click({ force: true });
    await page.waitForTimeout(800);
    const opt = page.locator('[role="option"]').filter({ hasText: optionText }).first();
    if (await opt.count() > 0) {
      await opt.click({ force: true });
      console.log(`Selected ${optionText} for ${buttonText}`);
      return true;
    }
    // fallback keyboard
    await page.keyboard.press('Escape');
    return false;
  } catch(e) {
    console.log(`select failed ${buttonText} -> ${optionText}: ${e.message}`);
    try { await page.keyboard.press('Escape'); } catch {}
    return false;
  }
}

async function run() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Opening...');
  await page.goto('https://chileempresas.com/anadir-empresa', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    document.querySelectorAll('iframe, ins.adsbygoogle').forEach(el => el.remove());
  });
  
  await page.fill('#name', 'LegalHelp Chile');
  await page.fill('#description', 'Orientación legal con inteligencia artificial en Chile. Analizamos demandas, citaciones y plazos fatales para arriendo, laboral, deudas, familia, civil y penal. Herramienta gratuita de diagnóstico legal adaptada a la legislación chilena (CPC, Código del Trabajo, Ley 19.968). No constituye asesoría legal formal. Atención en todo Chile vía WhatsApp.');
  await page.fill('#foundingYear', '2024');
  
  // Employees
  await selectOption(page, 'Selecciona el rango', '1-10');
  await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelectorAll('iframe, ins.adsbygoogle').forEach(el => el.remove()));
  
  // Sector - try different text variations
  let sectorOk = await selectOption(page, 'Selecciona un sector', 'Actividades profesionales');
  if (!sectorOk) {
    // try clicking and selecting first available
    try {
      const btn = page.locator('button').filter({ hasText: 'Selecciona un sector' }).first();
      await btn.click({ force: true });
      await page.waitForTimeout(800);
      const first = page.locator('[role="option"]').first();
      if (await first.count() > 0) {
        const text = await first.textContent();
        console.log('Picking first sector:', text);
        await first.click({ force: true });
      }
    } catch(e) { console.log('sector fallback failed', e.message); }
  }
  
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelectorAll('iframe, ins.adsbygoogle').forEach(el => el.remove()));
  
  // Region
  let regionOk = await selectOption(page, 'Selecciona una región', 'Metropolitana');
  if (!regionOk) {
    try {
      const btn = page.locator('button').filter({ hasText: 'Selecciona una región' }).first();
      await btn.click({ force: true });
      await page.waitForTimeout(800);
      const first = page.locator('[role="option"]').first();
      if (await first.count() > 0) await first.click({ force: true });
    } catch(e) { console.log('region fallback failed', e.message); }
  }
  
  await page.waitForTimeout(500);
  await page.fill('#city', 'Santiago');
  await page.fill('#address', 'Santiago, Región Metropolitana');
  await page.fill('#website', 'https://legalhelp.cl');
  await page.fill('#phone', '+56967658939');
  await page.fill('#email', email);
  await page.fill('#contactName', 'LegalHelp Chile');
  await page.fill('#contactRole', 'Gerente');
  
  // Remove ads again before checkbox
  await page.evaluate(() => document.querySelectorAll('iframe, ins.adsbygoogle').forEach(el => el.remove()));
  
  console.log('Checking legal...');
  try {
    // Use force click via evaluate
    await page.evaluate(() => {
      const el = document.getElementById('legal-acceptance');
      if (el) el.click();
    });
    await page.waitForTimeout(500);
    console.log('Legal checked via evaluate');
  } catch(e) { console.log('legal failed', e.message); }
  
  await page.waitForTimeout(1000);
  await page.evaluate(() => document.querySelectorAll('iframe, ins.adsbygoogle').forEach(el => el.remove()));
  await page.screenshot({ path: 'chileempresas2_filled.png', fullPage: true });
  console.log('Screenshot saved');
  
  const submit = page.locator('button[type="submit"]');
  const disabled = await submit.isDisabled();
  console.log('Submit disabled?', disabled);
  
  if (!disabled) {
    console.log('Submitting...');
    await submit.click({ force: true });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'chileempresas2_after.png', fullPage: true });
    console.log('URL:', page.url());
    const html = await page.content();
    if (html.includes('Gracias') || html.includes('revisará') || html.includes('enviada') || html.includes('éxito')) {
      console.log('SUCCESS');
    } else {
      console.log('Check screenshot - maybe validation error');
      // Log visible errors
      const errors = await page.locator('[role="alert"], .text-red-500, .text-destructive').allTextContents();
      console.log('Errors found:', errors);
    }
  } else {
    console.log('Still disabled - check screenshot');
    const errors = await page.locator('[role="alert"], .text-red-500').allTextContents().catch(() => []);
    console.log(errors);
  }
  
  await page.waitForTimeout(5000);
  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
