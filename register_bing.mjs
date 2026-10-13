import { chromium } from 'playwright';
async function run(){
  const browser = await chromium.launch({headless:false});
  const page = await browser.newPage();
  console.log('Opening Bing Places...');
  await page.goto('https://www.bingplaces.com', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(3000);
  await page.screenshot({path:'bing_before.png', fullPage:true});
  console.log('Screenshot bing_before');
  const content = await page.content();
  console.log('Has Sign in?', content.includes('Sign in') || content.includes('Iniciar'));
  console.log('URL:', page.url());
  // Try to find sign in or get started
  const buttons = await page.locator('a, button').allTextContents();
  console.log('Buttons:', buttons.slice(0,20));
  await page.waitForTimeout(5000);
  await browser.close();
}
run().catch(e=>{console.error(e);process.exit(1)});
