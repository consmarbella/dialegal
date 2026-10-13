import { chromium } from 'playwright';

const email = 'xaos27@gmail.com';
const pass = 'Ale2401-';

async function login(page){
  await page.goto('https://accounts.google.com/signin/v2/identifier?service=blogger&continue=https://www.blogger.com/', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(3000);
  await page.fill('#identifierId', email);
  await page.click('#identifierNext');
  await page.waitForTimeout(4000);
  await page.fill('input[type="password"]', pass);
  await page.click('#passwordNext');
  await page.waitForTimeout(6000);
  // Check for 2FA
  let content = await page.content();
  if(content.includes('Verifica') || content.includes('2-Step') || page.url().includes('challenge')){
    console.log('2FA detected, waiting 30s for approval...');
    // Wait for navigation to blogger
    try{
      await page.waitForURL('**/blogger.com/**', {timeout:90000});
      console.log('Logged in, URL:', page.url());
    }catch{
      console.log('Still on challenge, waiting more...');
      await page.waitForTimeout(30000);
    }
  }
  await page.waitForTimeout(2000);
}

async function run(){
  const browser = await chromium.launch({headless:false});
  const page = await browser.newPage();
  
  await login(page);
  console.log('Current URL after login:', page.url());
  await page.screenshot({path:'b_post_1_login.png', fullPage:true});
  
  // Go to blogger dashboard
  await page.goto('https://www.blogger.com/', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(3000);
  await page.screenshot({path:'b_post_2_dash.png', fullPage:true});
  console.log('Dashboard URL:', page.url());
  
  // Find existing blog and click New Post
  // Blogger dashboard has list of blogs, click on first blog's "New Post" or go to /blog/posts/<id>
  // We know blog ID from previous: 454707781364702540
  const blogId = '454707781364702540';
  console.log('Opening new post page...');
  await page.goto(`https://www.blogger.com/blog/posts/${blogId}`, {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(3000);
  await page.screenshot({path:'b_post_3_posts.png', fullPage:true});
  
  // Click "New post" button
  try{
    const newPostBtn = page.locator('a, button').filter({hasText:'New post'}).first();
    if(await newPostBtn.count()>0){
      console.log('Clicking New post...');
      await newPostBtn.click();
      await page.waitForTimeout(5000);
      await page.screenshot({path:'b_post_4_editor.png', fullPage:true});
      console.log('Editor URL:', page.url());
    } else {
      console.log('New post button not found, trying direct');
      await page.goto(`https://www.blogger.com/blog/post/edit/${blogId}/0`, {waitUntil:'domcontentloaded'});
      await page.waitForTimeout(5000);
      await page.screenshot({path:'b_post_4b_editor.png', fullPage:true});
    }
  }catch(e){ console.log('New post click failed', e.message); }
  
  await page.waitForTimeout(3000);
  console.log('Current editor URL:', page.url());
  await page.screenshot({path:'b_post_5_editor2.png', fullPage:true});
  
  // Try to fill title and content
  // Blogger editor is rich, may have contenteditable
  try{
    // Title
    const titleBox = page.locator('input[placeholder*="Title"], textarea[placeholder*="Title"], div[aria-label*="Title"]').first();
    if(await titleBox.count()>0){
      console.log('Found title box');
      await titleBox.fill('Prescripción Multas TAG Chile 2026 - Guía Completa y Servicio $15.000 + $10.000');
      console.log('Filled title');
    } else {
      // Try contenteditable title
      const titleEditable = page.locator('[contenteditable="true"]').first();
      if(await titleEditable.count()>0){
        await titleEditable.fill('Prescripción Multas TAG Chile 2026');
      }
    }
    await page.waitForTimeout(1000);
    
    // Content - find editor
    const contentEditable = page.locator('[contenteditable="true"]').nth(1);
    if(await contentEditable.count()>0){
      await contentEditable.click();
      await page.keyboard.type(`Si tienes multas TAG sin pagar en Chile (Autopista Central, Costanera Norte, Vespucio Norte, Vespucio Sur), puedes prescribirlas a los 3 años desde su anotación en el Registro Civil (Ley 18.287 Art 24).

En LegalHelp Chile analizamos tu certificado de multas por $15.000 y redactamos tu escrito por $10.000 por juzgado. Atención en todo Chile vía WhatsApp +56967658939.

Guías completas:
https://legalhelp.cl/prescripcion-multas-tag
https://legalhelp.cl/consultar-multas-tag
https://legalhelp.cl/condonacion-multas-tag-2026
https://legalhelp.cl/multas-autopista-central
https://legalhelp.cl/prescripcion-de-multas-de-transito

Plazos legales:
- Multas conductor: 1 año (Ley 15.231 Art 54)
- Multas TAG/patente: 3 años (Ley 18.287 Art 24)
- Deuda civil: 5 años (Código Civil Art 2515)

Fuentes: Registro Civil, Ley 21.547 condonación 80%, Juzgados de Policía Local.
`, {delay:10});
      console.log('Filled content');
    }
    
    await page.waitForTimeout(2000);
    await page.screenshot({path:'b_post_6_filled.png', fullPage:true});
    
    // Publish
    const publishBtn = page.locator('button, div[role="button"]').filter({hasText:'Publish'}).first();
    if(await publishBtn.count()>0){
      console.log('Clicking Publish...');
      await publishBtn.click({force:true});
      await page.waitForTimeout(3000);
      // Confirm publish
      const confirmBtn = page.locator('button').filter({hasText:'Confirm'}).first();
      if(await confirmBtn.count()>0){
        await confirmBtn.click();
        console.log('Confirmed publish');
        await page.waitForTimeout(3000);
      }
      await page.screenshot({path:'b_post_7_published.png', fullPage:true});
      console.log('Published URL:', page.url());
    } else {
      console.log('Publish not found');
      const btns = await page.locator('button').allTextContents();
      console.log(btns.slice(0,20));
    }
  }catch(e){ console.log('Fill failed', e.message); }
  
  await page.waitForTimeout(10000);
  await browser.close();
}
run().catch(e=>{console.error(e); process.exit(1)});
