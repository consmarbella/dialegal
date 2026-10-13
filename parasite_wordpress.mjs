import { chromium } from 'playwright';
async function run(){
  const browser = await chromium.launch({headless:false});
  const page = await browser.newPage();
  const email='xaos27@gmail.com';
  const pass='Ale2401-';
  
  console.log('Opening WordPress.com...');
  await page.goto('https://wordpress.com/start/', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(3000);
  await page.screenshot({path:'wp_1.png', fullPage:true});
  console.log('URL:', page.url());
  
  // Try to find email input
  const emailSelectors = ['input[type="email"]', 'input[name="email"]', '#email'];
  for(let sel of emailSelectors){
    if(await page.locator(sel).count()>0){
      console.log(`Filling ${sel}`);
      await page.fill(sel, email);
      break;
    }
  }
  await page.waitForTimeout(1000);
  // Click continue
  const contBtn = page.locator('button:has-text("Continue"), button:has-text("Continuar")').first();
  if(await contBtn.count()>0){
    await contBtn.click();
    console.log('Clicked continue');
    await page.waitForTimeout(4000);
    await page.screenshot({path:'wp_2.png', fullPage:true});
  }
  
  // Check for password or username step
  const passInput = page.locator('input[type="password"]');
  if(await passInput.count()>0){
    console.log('Filling password...');
    await passInput.fill(pass);
    await page.waitForTimeout(1000);
  }
  
  await page.waitForTimeout(3000);
  await page.screenshot({path:'wp_3.png', fullPage:true});
  console.log('Current URL:', page.url());
  console.log('Content has WordPress?', (await page.content()).includes('WordPress'));
  
  await page.waitForTimeout(5000);
  await browser.close();
}
run().catch(e=>{console.error(e); process.exit(1)});
