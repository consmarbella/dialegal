import { chromium } from 'playwright';

const email = 'xaos27@gmail.com';

async function run() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Opening ChileEmpresas...');
  await page.goto('https://chileempresas.com/anadir-empresa', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Fill name
  console.log('Filling name...');
  await page.fill('#name', 'LegalHelp Chile');
  
  // Description
  console.log('Filling description...');
  await page.fill('#description', 'Orientación legal con inteligencia artificial en Chile. Analizamos demandas, citaciones y plazos fatales para arriendo, laboral, deudas, familia, civil y penal. Herramienta gratuita de diagnóstico legal adaptada a la legislación chilena (CPC, Código del Trabajo, Ley 19.968). No constituye asesoría legal formal. Atención en todo Chile vía WhatsApp.');
  
  // Año
  await page.fill('#foundingYear', '2024');
  
  // Employees - combobox
  console.log('Selecting employees...');
  try {
    const empButton = page.locator('button').filter({ hasText: 'Selecciona el rango' }).first();
    await empButton.click();
    await page.waitForTimeout(500);
    // Try to find option 1-10
    const option = page.locator('[role="option"]').filter({ hasText: '1-10' }).first();
    if (await option.count() > 0) {
      await option.click();
    } else {
      // fallback: try 2-10 or similar
      const opt2 = page.locator('[role="option"]').first();
      if (await opt2.count() > 0) await opt2.click();
    }
  } catch(e) { console.log('employees select failed', e.message); }
  
  // Sector
  console.log('Selecting sector...');
  try {
    const sectorButton = page.locator('button').filter({ hasText: 'Selecciona un sector' }).first();
    await sectorButton.click();
    await page.waitForTimeout(800);
    const sectorOption = page.locator('[role="option"]').filter({ hasText: 'Actividades profesionales' }).first();
    if (await sectorOption.count() > 0) {
      await sectorOption.click();
      console.log('Sector selected');
    } else {
      console.log('Sector option not found, trying first option');
      const firstOpt = page.locator('[role="option"]').first();
      if (await firstOpt.count() > 0) await firstOpt.click();
    }
  } catch(e) { console.log('sector failed', e.message); }
  
  await page.waitForTimeout(500);
  
  // Region
  console.log('Selecting region...');
  try {
    const regionButton = page.locator('button').filter({ hasText: 'Selecciona una región' }).first();
    await regionButton.click();
    await page.waitForTimeout(800);
    const regionOption = page.locator('[role="option"]').filter({ hasText: 'Metropolitana' }).first();
    if (await regionOption.count() > 0) {
      await regionOption.click();
      console.log('Region selected');
    } else {
      const firstOpt = page.locator('[role="option"]').first();
      if (await firstOpt.count() > 0) await firstOpt.click();
    }
  } catch(e) { console.log('region failed', e.message); }
  
  await page.waitForTimeout(500);
  
  // City
  await page.fill('#city', 'Santiago');
  await page.fill('#address', 'Santiago, Región Metropolitana');
  
  // Contact
  await page.fill('#website', 'https://legalhelp.cl');
  await page.fill('#phone', '+56967658939');
  await page.fill('#email', email);
  await page.fill('#contactName', 'LegalHelp Chile');
  await page.fill('#contactRole', 'Gerente');
  
  await page.waitForTimeout(500);
  
  // Check legal acceptance
  console.log('Checking legal acceptance...');
  try {
    const legalCheckbox = page.locator('#legal-acceptance');
    await legalCheckbox.click();
    await page.waitForTimeout(500);
    console.log('Legal checkbox clicked');
  } catch(e) { console.log('legal checkbox failed', e.message); }
  
  await page.waitForTimeout(1000);
  
  // Take screenshot
  await page.screenshot({ path: 'chileempresas_filled.png', fullPage: true });
  console.log('Screenshot saved');
  
  // Check if submit button is enabled
  const submitButton = page.locator('button[type="submit"]');
  const isDisabled = await submitButton.isDisabled();
  console.log('Submit disabled?', isDisabled);
  
  if (!isDisabled) {
    console.log('Clicking submit...');
    await submitButton.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'chileempresas_after_submit.png', fullPage: true });
    console.log('After submit screenshot saved');
    console.log('URL after submit:', page.url());
    const content = await page.content();
    if (content.includes('Gracias') || content.includes('éxito') || content.includes('revisará') || content.includes('enviada')) {
      console.log('SUCCESS: Form appears submitted');
    } else {
      console.log('Form submit may have failed, check screenshot');
    }
  } else {
    console.log('Submit still disabled - missing required fields or validation');
    // Try to find what's missing
    const html = await page.content();
    // Look for validation messages
    console.log('Check screenshot for missing fields');
  }
  
  await page.waitForTimeout(5000);
  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
