import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

chromium.use(stealth());

const email = 'xaos27@gmail.com';
const pass = 'Ale2401-';

async function run(){
  const browser = await chromium.launch({ headless:false, args:['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: {width:1280, height:800}
  });
  const page = await context.newPage();
  
  console.log('Opening Google login...');
  await page.goto('https://accounts.google.com/signin', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2000);
  
  // Fill email
  console.log('Filling email...');
  await page.fill('input[type="email"]', email);
  await page.click('#identifierNext');
  await page.waitForTimeout(3000);
  
  // Check for 2FA or password page
  const url = page.url();
  console.log('URL after email:', url);
  await page.screenshot({path:'blogger_login1.png', fullPage:true});
  
  // Fill password if present
  try{
    const passInput = page.locator('input[type="password"]');
    if(await passInput.count()>0){
      console.log('Filling password...');
      await passInput.fill(pass);
      await page.click('#passwordNext');
      await page.waitForTimeout(4000);
      await page.screenshot({path:'blogger_login2.png', fullPage:true});
      console.log('After password URL:', page.url());
      
      // Check for 2FA
      const content = await page.content();
      if(content.includes('Verifica') || content.includes('2-Step') || content.includes('Código') || content.includes('verificación')){
        console.log('2FA REQUIRED - waiting for user to provide code...');
        console.log('Por favor ingresa el código de verificación que llegó a xaos27@gmail.com');
        // Wait 90 seconds for user to manually enter code in the visible browser
        await page.waitForTimeout(90000);
        await page.screenshot({path:'blogger_after2fa.png', fullPage:true});
      }
    }
  }catch(e){ console.log('Password step failed', e.message); }
  
  await page.waitForTimeout(2000);
  console.log('Current URL:', page.url());
  await page.screenshot({path:'blogger_final.png', fullPage:true});
  
  // Try to go to Blogger
  console.log('Going to Blogger...');
  await page.goto('https://www.blogger.com/about', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(3000);
  await page.screenshot({path:'blogger_about.png', fullPage:true});
  
  // Try to create blog - Blogger creation is at https://www.blogger.com/blog/new
  await page.goto('https://www.blogger.com/', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(3000);
  await page.screenshot({path:'blogger_home.png', fullPage:true});
  console.log('Blogger home URL:', page.url());
  
  await page.waitForTimeout(10000);
  await browser.close();
}
run().catch(e=>{console.error(e); process.exit(1)});
