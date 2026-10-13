import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
chromium.use(stealth());

const email='xaos27@gmail.com';
const pass='Ale2401-';
const username='LegalHelpChile_'+Math.floor(Math.random()*9000+1000);

async function run(){
  const browser = await chromium.launch({headless:false, args:['--disable-blink-features=AutomationControlled']});
  const context = await browser.newContext({
    userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport:{width:1280, height:800}
  });
  const page = await context.newPage();
  
  console.log(`Creating Reddit account ${username}...`);
  await page.goto('https://www.reddit.com/register/', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(4000);
  await page.screenshot({path:'reddit_r1.png', fullPage:true});
  
  // Fill email
  try{
    const emailInput = page.locator('input[name="email"]');
    if(await emailInput.count()>0){
      await emailInput.fill(email);
      console.log('Filled email');
      await page.waitForTimeout(1000);
    }
  }catch(e){ console.log('Email fill failed', e.message); }
  
  // Continue button
  try{
    const cont = page.locator('button:has-text("Continue"), button:has-text("Continuar")').first();
    if(await cont.count()>0){
      await cont.click();
      console.log('Clicked Continue');
      await page.waitForTimeout(3000);
      await page.screenshot({path:'reddit_r2.png', fullPage:true});
    }
  }catch(e){ console.log(e.message); }
  
  // Username and password
  try{
    const userInput = page.locator('input[name="username"]');
    if(await userInput.count()>0){
      await userInput.fill(username);
      console.log(`Filled username ${username}`);
    }
    const passInput = page.locator('input[name="password"]');
    if(await passInput.count()>0){
      await passInput.fill(pass);
      console.log('Filled password');
    }
    await page.waitForTimeout(1000);
    const signupBtn = page.locator('button:has-text("Sign Up"), button:has-text("Registrarse")').first();
    if(await signupBtn.count()>0){
      await signupBtn.click();
      console.log('Clicked Sign Up');
      await page.waitForTimeout(5000);
      await page.screenshot({path:'reddit_r3.png', fullPage:true});
      console.log('URL after signup:', page.url());
    }
  }catch(e){ console.log('Signup failed', e.message); }
  
  // Check for verification
  await page.waitForTimeout(3000);
  let content = await page.content();
  if(content.includes('verify') || content.includes('Verifica') || content.includes('email')){
    console.log('Verification required - check xaos27@gmail.com for code');
    console.log('Waiting 90s for manual verification...');
    await page.waitForTimeout(90000);
    await page.screenshot({path:'reddit_r4_verify.png', fullPage:true});
  }
  
  console.log('Current URL:', page.url());
  await page.screenshot({path:'reddit_r5_final.png', fullPage:true});
  
  // Try to post to r/chile if logged in
  if(page.url().includes('reddit.com') && !page.url().includes('register')){
    console.log('Attempting to post to r/chile...');
    await page.goto('https://www.reddit.com/r/chile/submit/', {waitUntil:'domcontentloaded'});
    await page.waitForTimeout(4000);
    await page.screenshot({path:'reddit_r6_submit.png', fullPage:true});
    
    // Fill title
    try{
      const titleInput = page.locator('textarea[placeholder*="Title"], input[placeholder*="Title"], #title').first();
      if(await titleInput.count()>0){
        await titleInput.fill('¿Multas TAG sin pagar? Prescriben a los 3 años - te ayudo por $15.000');
        console.log('Filled title');
      }
      // Body - switch to markdown
      const bodyInput = page.locator('[contenteditable="true"], textarea[placeholder*="Text"]').first();
      if(await bodyInput.count()>0){
        await bodyInput.click();
        await page.keyboard.type(`Si circulaste por Autopista Central, Costanera Norte o Vespucio sin TAG habilitado, puedes tener multas TAG que PRESCRIBEN a los 3 años (Ley 18.287 Art 24).

En LegalHelp Chile analizamos tu certificado por $15.000 y redactamos el escrito por $10.000 por juzgado. Atención en todo Chile vía WhatsApp.

Guías:
- https://legalhelp.cl/prescripcion-multas-tag
- https://legalhelp.cl/consultar-multas-tag
- https://legalhelp.cl/condonacion-multas-tag-2026

WhatsApp: +56967658939
`, {delay:20});
        console.log('Filled body');
      }
      await page.waitForTimeout(2000);
      await page.screenshot({path:'reddit_r7_filled.png', fullPage:true});
      
      const postBtn = page.locator('button:has-text("Post"), button:has-text("Publicar")').first();
      if(await postBtn.count()>0 && !(await postBtn.isDisabled())){
        await postBtn.click();
        console.log('Clicked Post');
        await page.waitForTimeout(5000);
        await page.screenshot({path:'reddit_r8_posted.png', fullPage:true});
        console.log('Post URL:', page.url());
      } else {
        console.log('Post button disabled or not found');
      }
    }catch(e){ console.log('Post failed', e.message); }
  }
  
  await page.waitForTimeout(10000);
  await browser.close();
}
run().catch(e=>{console.error(e); process.exit(1)});
