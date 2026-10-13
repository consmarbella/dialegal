import { chromium } from 'playwright';

const email = 'xaos27@gmail.com';
const pass = 'Ale2401-';

async function run(){
  const browser = await chromium.launch({ headless:false, args:['--disable-blink-features=AutomationControlled'] });
  const page = await browser.newPage();
  
  console.log('Opening Google login...');
  await page.goto('https://accounts.google.com/signin/v2/identifier?service=blogger&continue=https://www.blogger.com/', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(4000);
  await page.screenshot({path:'b2_1.png', fullPage:true});
  console.log('URL:', page.url());
  
  // Try multiple selectors
  const selectors = ['#identifierId', 'input[type="email"]', 'input#identifierId', 'input[name="identifier"]'];
  let found = false;
  for(let sel of selectors){
    try{
      const cnt = await page.locator(sel).count();
      console.log(`Selector ${sel}: ${cnt}`);
      if(cnt>0){
        console.log(`Filling ${sel}...`);
        await page.fill(sel, email);
        found = true;
        break;
      }
    }catch(e){ console.log(`sel ${sel} failed ${e.message}`);}
  }
  if(!found){
    console.log('No email input found, content snippet:');
    const html = await page.content();
    console.log(html.slice(0,2000));
    await page.waitForTimeout(10000);
    await browser.close();
    return;
  }
  
  await page.waitForTimeout(1000);
  const nextBtn = page.locator('#identifierNext, button:has-text("Siguiente"), button:has-text("Next")').first();
  if(await nextBtn.count()>0){
    await nextBtn.click();
    console.log('Clicked next');
  } else {
    await page.keyboard.press('Enter');
  }
  
  await page.waitForTimeout(5000);
  await page.screenshot({path:'b2_2.png', fullPage:true});
  console.log('URL after email:', page.url());
  
  // Password
  try{
    const passSel = ['input[type="password"]', 'input[name="password"]', '#password input'];
    for(let sel of passSel){
      if(await page.locator(sel).count()>0){
        console.log(`Filling password via ${sel}`);
        await page.fill(sel, pass);
        break;
      }
    }
    const passNext = page.locator('#passwordNext, button:has-text("Siguiente"), button:has-text("Next")').first();
    if(await passNext.count()>0){ await passNext.click(); console.log('Clicked password next'); }
    else { await page.keyboard.press('Enter'); }
    await page.waitForTimeout(6000);
    await page.screenshot({path:'b2_3.png', fullPage:true});
    console.log('URL after pass:', page.url());
    
    const content = await page.content();
    if(content.includes('Verifica') || content.includes('2-Step') || content.includes('Código')){
      console.log('2FA detected - waiting 90s for manual code entry...');
      await page.waitForTimeout(90000);
      await page.screenshot({path:'b2_4.png', fullPage:true});
    }
  }catch(e){ console.log('pass failed', e.message); }
  
  await page.waitForTimeout(3000);
  console.log('Final URL:', page.url());
  await page.screenshot({path:'b2_final.png', fullPage:true});
  
  // Try Blogger
  console.log('Going to Blogger...');
  await page.goto('https://www.blogger.com/', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(4000);
  await page.screenshot({path:'b2_blogger.png', fullPage:true});
  console.log('Blogger URL:', page.url());
  
  await page.waitForTimeout(10000);
  await browser.close();
}
run().catch(e=>{console.error(e); process.exit(1)});
