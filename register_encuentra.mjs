import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const email = 'xaos27@gmail.com';
  
  console.log('Opening EncuentraEmpresas registro...');
  await page.goto('https://www.encuentraempresas.cl/registro.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  // Fill form - inspect selectors
  const inputs = await page.locator('input, select, textarea').all();
  console.log('Inputs found:', inputs.length);
  for (let i=0; i<inputs.length; i++) {
    try {
      const el = inputs[i];
      const tag = await el.evaluate(e => e.tagName);
      const type = await el.getAttribute('type');
      const name = await el.getAttribute('name');
      const id = await el.getAttribute('id');
      const placeholder = await el.getAttribute('placeholder');
      const text = await el.evaluate(e => e.outerHTML.slice(0,150));
      console.log(`[${i}] ${tag} type=${type} name=${name} id=${id} placeholder=${placeholder}`);
    } catch {}
  }
  
  // Try to fill by placeholder/name
  try {
    // Nombre de la empresa - first input
    await page.locator('input').first().fill('LegalHelp Chile');
    console.log('Filled nombre');
  } catch(e) { console.log('nombre failed', e.message); }
  
  // Need to handle selects for Categoria and Region
  // Categoria select - find select element
  try {
    const selects = page.locator('select');
    const count = await selects.count();
    console.log('Selects:', count);
    for (let i=0; i<count; i++) {
      const sel = selects.nth(i);
      const options = await sel.locator('option').allTextContents();
      console.log(`Select ${i} options:`, options.slice(0,10));
    }
    // Select categoria - try to select "Servicios Empresariales" or similar
    if (count >= 1) {
      const catSelect = selects.first();
      // Try to select by label
      const opts = await catSelect.locator('option').all();
      for (let opt of opts) {
        const txt = await opt.textContent();
        if (txt && txt.includes('Servicios Empresariales')) {
          const val = await opt.getAttribute('value');
          console.log('Selecting Servicios Empresariales value:', val);
          await catSelect.selectOption(val);
          break;
        }
      }
    }
    if (count >= 2) {
      const regionSelect = selects.nth(1);
      const opts = await regionSelect.locator('option').all();
      for (let opt of opts) {
        const txt = await opt.textContent();
        if (txt && txt.includes('Metropolitana')) {
          const val = await opt.getAttribute('value');
          console.log('Selecting Metropolitana value:', val);
          await regionSelect.selectOption(val);
          break;
        }
      }
    }
  } catch(e) { console.log('select failed', e.message); }
  
  await page.waitForTimeout(1000);
  
  // Fill remaining inputs by order - we need to map correctly
  // After selects, inputs are: comuna, tu nombre, email, telefono, sitio web
  try {
    const allInputs = page.locator('input');
    const cnt = await allInputs.count();
    console.log('Total inputs now:', cnt);
    // Try to fill by identifying via surrounding label
    // Use evaluate to find inputs by placeholder or by position
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      // Find by placeholder or type
      for (let inp of inputs) {
        const ph = inp.placeholder || '';
        if (ph.includes('Comuna') || inp.previousElementSibling?.textContent?.includes('Comuna')) {
          inp.value = 'Santiago';
          inp.dispatchEvent(new Event('input', {bubbles:true}));
          inp.dispatchEvent(new Event('change', {bubbles:true}));
        }
      }
    });
  } catch(e) { console.log('comuna fill failed', e.message); }
  
  // Simpler: fill all visible inputs sequentially after selects
  try {
    // Get all text inputs
    const textInputs = page.locator('input[type="text"], input:not([type]), input[type="email"], input[type="tel"], input[type="url"]');
    const n = await textInputs.count();
    console.log('Text inputs:', n);
    for (let i=0; i<n; i++) {
      const inp = textInputs.nth(i);
      const placeholder = await inp.getAttribute('placeholder') || '';
      const currentVal = await inp.inputValue().catch(()=> '');
      console.log(`Text input ${i} placeholder="${placeholder}" value="${currentVal}"`);
    }
  } catch(e) { console.log(e.message); }
  
  await page.screenshot({ path: 'encuentra_before.png', fullPage: true });
  console.log('Screenshot saved, check encuentra_before.png');
  
  // Try filling with more direct approach - fill by index
  // Based on form order: Nombre, Categoria(select), Region(select), Comuna, Tu nombre, Email, Telefono, Sitio web
  try {
    const inputs = page.locator('input');
    // Input 0 is Nombre already filled
    // Input 1 is Comuna (after selects)
    // Let's try to fill comuna as input nth 1
    const comunaInput = page.locator('input').nth(1);
    if (await comunaInput.count() > 0) {
      await comunaInput.fill('Santiago');
      console.log('Filled comuna Santiago');
    }
    const nombreInput = page.locator('input').nth(2);
    if (await nombreInput.count() > 0) {
      await nombreInput.fill('LegalHelp Chile');
      console.log('Filled tu nombre');
    }
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.count() > 0) {
      await emailInput.fill(email);
      console.log('Filled email');
    }
    const telInput = page.locator('input[type="tel"], input[placeholder*="Tel"]').first();
    // Try to find tel by near label
    const allInputs = await page.locator('input').all();
    for (let inp of allInputs) {
      const html = await inp.evaluate(e => e.outerHTML);
      if (html.includes('Tel') || html.includes('WhatsApp')) {
        await inp.fill('+56967658939');
        console.log('Filled tel via HTML match');
        break;
      }
    }
    // Fallback: try 4th input
    try {
      await page.locator('input').nth(3).fill('+56967658939');
      console.log('Filled tel nth 3');
    } catch {}
    
    const webInput = page.locator('input[type="url"]');
    if (await webInput.count() > 0) {
      await webInput.fill('https://legalhelp.cl');
      console.log('Filled web');
    }
  } catch(e) { console.log('fill sequence failed', e.message); }
  
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'encuentra_filled.png', fullPage: true });
  console.log('Filled screenshot');
  
  // Find submit button
  try {
    const btn = page.locator('button, input[type="submit"], a').filter({ hasText: 'Registrar' }).first();
    if (await btn.count() > 0) {
      console.log('Found registrar button, clicking...');
      const disabled = await btn.isDisabled().catch(()=> false);
      console.log('Disabled?', disabled);
      if (!disabled) {
        await btn.click({ force: true });
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'encuentra_after.png', fullPage: true });
        console.log('After submit URL:', page.url());
        const content = await page.content();
        if (content.includes('Gracias') || content.includes('éxito') || content.includes('24 horas') || content.includes('ficha')) {
          console.log('SUCCESS EncuentraEmpresas');
        } else {
          console.log('Check screenshot for result');
        }
      }
    } else {
      console.log('Registrar button not found');
      const buttons = await page.locator('button').allTextContents();
      console.log('Buttons:', buttons);
    }
  } catch(e) { console.log('submit failed', e.message); }
  
  await page.waitForTimeout(5000);
  await browser.close();
}
run().catch(e=>{console.error(e); process.exit(1)});
