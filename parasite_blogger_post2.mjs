import { chromium } from 'playwright';

const email = 'xaos27@gmail.com';
const pass = 'Ale2401-';

async function login(page){
  await page.goto('https://accounts.google.com/signin/v2/identifier?service=blogger&continue=https://www.blogger.com/', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(4000);
  console.log('Filling email...');
  await page.fill('#identifierId', email);
  await page.click('#identifierNext');
  console.log('Clicked email next, waiting...');
  await page.waitForTimeout(6000);
  await page.screenshot({path:'bb2_1_after_email.png', fullPage:true});
  console.log('URL after email:', page.url());
  
  // Check what we have
  const hasPassword = await page.locator('input[type="password"]').count();
  console.log('Has password input?', hasPassword);
  
  if(hasPassword>0){
    console.log('Filling password...');
    await page.locator('input[type="password"]').first().fill(pass);
    await page.waitForTimeout(1000);
    const nextBtn = page.locator('#passwordNext');
    if(await nextBtn.count()>0) await nextBtn.click();
    else await page.keyboard.press('Enter');
    console.log('Clicked password next');
    await page.waitForTimeout(8000);
    await page.screenshot({path:'bb2_2_after_pass.png', fullPage:true});
    console.log('URL after pass:', page.url());
  } else {
    console.log('No password input, checking content...');
    const html = await page.content();
    console.log(html.slice(4000,6000));
  }
  
  // Wait for possible 2FA
  await page.waitForTimeout(3000);
  let content = await page.content();
  if(page.url().includes('challenge') || content.includes('Verifica') || content.includes('2-Step')){
    console.log('Challenge/2FA detected, waiting 60s for approval...');
    try{
      await page.waitForURL('**/blogger.com/**', {timeout:90000});
      console.log('Reached Blogger after 2FA!');
    }catch{
      console.log('Still not at Blogger after 90s, current URL:', page.url());
      await page.screenshot({path:'bb2_3_challenge.png', fullPage:true});
    }
  }
  await page.waitForTimeout(3000);
  console.log('Final login URL:', page.url());
}

async function run(){
  const browser = await chromium.launch({headless:false});
  const page = await browser.newPage();
  
  await login(page);
  console.log('After login URL:', page.url());
  await page.screenshot({path:'bb2_login_done.png', fullPage:true});
  
  if(!page.url().includes('blogger.com')){
    console.log('Not at Blogger, trying to goto Blogger...');
    await page.goto('https://www.blogger.com/', {waitUntil:'domcontentloaded'});
    await page.waitForTimeout(4000);
    console.log('Blogger URL:', page.url());
    await page.screenshot({path:'bb2_blogger_home.png', fullPage:true});
  }
  
  // Try to create post - we know blog ID
  const blogId = '454707781364702540';
  console.log('Opening posts page...');
  await page.goto(`https://www.blogger.com/blog/posts/${blogId}`, {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(4000);
  await page.screenshot({path:'bb2_posts.png', fullPage:true});
  
  // Try new post
  const newPostSelectors = ['a:has-text("New post")', 'button:has-text("New post")', 'a:has-text("Nueva entrada")'];
  let clicked = false;
  for(let sel of newPostSelectors){
    const el = page.locator(sel).first();
    if(await el.count()>0){
      console.log(`Clicking ${sel}...`);
      await el.click();
      clicked = true;
      break;
    }
  }
  if(!clicked){
    console.log('No New post button, trying direct edit URL...');
    await page.goto(`https://www.blogger.com/blog/post/edit/${blogId}/0`, {waitUntil:'domcontentloaded'});
  }
  
  await page.waitForTimeout(6000);
  console.log('Editor URL:', page.url());
  await page.screenshot({path:'bb2_editor.png', fullPage:true});
  
  // Try to fill post - Blogger new editor
  try{
    // Title - try various selectors
    const titleSels = ['input[placeholder*="Title"]', 'textarea[placeholder*="Title"]', '[aria-label*="Title"]', '.post-title input'];
    for(let sel of titleSels){
      if(await page.locator(sel).count()>0){
        console.log(`Filling title via ${sel}`);
        await page.locator(sel).first().fill('Prescripción Multas TAG Chile 2026 - Guía Completa $15.000 + $10.000');
        break;
      }
    }
    // Try contenteditable
    const editables = page.locator('[contenteditable="true"]');
    const cnt = await editables.count();
    console.log('Contenteditables:', cnt);
    if(cnt>=1){
      // Last one is content
      const contentBox = editables.last();
      await contentBox.click();
      await page.waitForTimeout(500);
      await page.keyboard.type(`Si tienes multas TAG sin pagar en Chile (Autopista Central, Costanera Norte, Vespucio), puedes prescribirlas a los 3 años (Ley 18.287 Art 24).

LegalHelp Chile: Análisis $15.000 + escrito $10.000 vía WhatsApp +56967658939
https://legalhelp.cl/prescripcion-multas-tag

Guías:
https://legalhelp.cl/consultar-multas-tag
https://legalhelp.cl/condonacion-multas-tag-2026
https://legalhelp.cl/multas-autopista-central
`, {delay:20});
      console.log('Filled content');
    }
    await page.waitForTimeout(2000);
    await page.screenshot({path:'bb2_filled.png', fullPage:true});
    
    // Publish
    const pubBtn = page.locator('button:has-text("Publish"), div[role="button"]:has-text("Publish"), button:has-text("Publicar")').first();
    if(await pubBtn.count()>0){
      console.log('Clicking Publish...');
      await pubBtn.click();
      await page.waitForTimeout(3000);
      const confirm = page.locator('button:has-text("Confirm"), button:has-text("Confirmar")').first();
      if(await confirm.count()>0){
        await confirm.click();
        console.log('Confirmed');
        await page.waitForTimeout(3000);
      }
      await page.screenshot({path:'bb2_published.png', fullPage:true});
      console.log('Published, URL:', page.url());
    } else {
      console.log('Publish not found');
      const btns = await page.locator('button').allTextContents();
      console.log(btns.slice(0,15));
    }
  }catch(e){ console.log('Fill error', e.message); }
  
  await page.waitForTimeout(10000);
  await browser.close();
}
run().catch(e=>{console.error(e); process.exit(1)});
