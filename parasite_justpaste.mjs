import { chromium } from 'playwright';
async function run(){
  const browser = await chromium.launch({headless:false});
  const page = await browser.newPage();
  console.log('Opening JustPaste.it...');
  await page.goto('https://justpaste.it/', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2000);
  // Click "Add" or find editor
  try{
    // JustPaste.it has big "Add" button or editor on homepage
    const editor = page.locator('[contenteditable="true"], textarea, .ql-editor').first();
    if(await editor.count()>0){
      console.log('Editor found');
      await editor.click();
      await editor.fill(`Prescripción Multas TAG Chile 2026 - Guía Completa

Si tienes multas TAG sin pagar en Chile (Autopista Central, Costanera Norte, Vespucio), puedes PRESCRIBIRLAS a los 3 años (Ley 18.287 Art 24) desde anotación en Registro Civil.

SERVICIO LEGALHELP CHILE:
Análisis técnico $15.000 + escrito $10.000 por juzgado vía WhatsApp +56967658939
https://legalhelp.cl/prescripcion-multas-tag

Más guías:
- Consultar multas TAG: https://legalhelp.cl/consultar-multas-tag
- Condonación 80% 2026: https://legalhelp.cl/condonacion-multas-tag-2026
- Multas Autopista Central: https://legalhelp.cl/multas-autopista-central
- Prescripción multas tránsito: https://legalhelp.cl/prescripcion-de-multas-de-transito

Plazos:
- Multas conductor: 1 año (Ley 15.231 Art 54)
- Multas TAG/patente: 3 años (Ley 18.287 Art 24)
- Deuda civil concesionaria: 5 años (Código Civil Art 2515)

Fuentes: Registro Civil, Ley 21.547, Juzgados Policía Local.
`);
      console.log('Filled content');
    } else {
      console.log('No editor, searching for add button');
      const addBtn = page.locator('a, button').filter({hasText:'Add'}).first();
      if(await addBtn.count()>0){
        await addBtn.click();
        await page.waitForTimeout(2000);
        const editor2 = page.locator('[contenteditable="true"]').first();
        await editor2.fill('Test content LegalHelp');
      }
    }
    await page.waitForTimeout(1000);
    await page.screenshot({path:'justpaste_filled.png', fullPage:true});
    console.log('Screenshot filled');
    
    // Find publish button
    const publish = page.locator('button, a').filter({hasText:'Publish'}).first();
    if(await publish.count()>0){
      console.log('Found Publish, clicking');
      await publish.click({force:true});
      await page.waitForTimeout(3000);
      await page.screenshot({path:'justpaste_after.png', fullPage:true});
      console.log('URL after:', page.url());
      if(page.url().includes('justpaste.it/')){
        console.log('SUCCESS JustPaste', page.url());
      }
    } else {
      console.log('Publish not found');
      const btns = await page.locator('button').allTextContents();
      console.log('Buttons:', btns.slice(0,10));
    }
  }catch(e){ console.log('Error', e.message); }
  await page.waitForTimeout(4000);
  await browser.close();
}
run().catch(e=>{console.error(e);process.exit(1)});
