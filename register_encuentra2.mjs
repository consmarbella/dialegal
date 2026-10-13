import { chromium } from 'playwright';
async function run(){
  const browser = await chromium.launch({headless:false});
  const page = await browser.newPage();
  const email='xaos27@gmail.com';
  console.log('Opening...');
  await page.goto('https://www.encuentraempresas.cl/registro.html', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2000);
  
  // Fill correctly by name attribute
  await page.locator('input[name="nombre_empresa"]').fill('LegalHelp Chile');
  console.log('Filled nombre_empresa');
  
  // Select categoria - use selectOption with label
  await page.locator('select[name="categoria"]').selectOption({label:'Servicios Empresariales'});
  console.log('Selected categoria');
  await page.locator('select[name="region"]').selectOption({label:'Metropolitana'});
  console.log('Selected region');
  
  await page.locator('input[name="comuna"]').fill('Santiago');
  await page.locator('input[name="nombre_contacto"]').fill('LegalHelp Chile');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="telefono"]').fill('+56967658939');
  await page.locator('input[name="web"]').fill('https://legalhelp.cl');
  console.log('Filled all text fields');
  
  await page.waitForTimeout(800);
  await page.screenshot({path:'encuentra2_filled.png', fullPage:true});
  console.log('Screenshot filled');
  
  // Check values
  const vals = await page.evaluate(() => {
    return {
      nombre: document.querySelector('input[name="nombre_empresa"]')?.value,
      cat: document.querySelector('select[name="categoria"]')?.value,
      region: document.querySelector('select[name="region"]')?.value,
      comuna: document.querySelector('input[name="comuna"]')?.value,
      contacto: document.querySelector('input[name="nombre_contacto"]')?.value,
      email: document.querySelector('input[name="email"]')?.value,
      tel: document.querySelector('input[name="telefono"]')?.value,
      web: document.querySelector('input[name="web"]')?.value,
    };
  });
  console.log('Values:', vals);
  
  const btn = page.locator('button, input[type="submit"]').filter({hasText:'Registrar'}).first();
  if(await btn.count()>0){
    console.log('Clicking registrar...');
    await btn.click({force:true});
    await page.waitForTimeout(4000);
    await page.screenshot({path:'encuentra2_after.png', fullPage:true});
    console.log('URL after:', page.url());
    const content = await page.content();
    // More specific success check: look for thank you or new URL
    if(page.url().includes('gracias') || page.url().includes('exito') || content.includes('Tu ficha') && content.includes('Gracias')){
      console.log('SUCCESS');
    } else {
      console.log('Check screenshot - may need validation');
      // Log any error messages
      const html = await page.evaluate(() => document.body.innerText.slice(0,2000));
      console.log(html.slice(0,1000));
    }
  } else {
    console.log('Button not found');
    const btns = await page.locator('button').allTextContents();
    console.log(btns);
  }
  
  await page.waitForTimeout(5000);
  await browser.close();
}
run().catch(e=>{console.error(e);process.exit(1)});
