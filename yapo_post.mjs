import { chromium } from 'playwright';
const email='xaos27@gmail.com';
const pass='Ale2401-';
async function run(){
  const browser = await chromium.launch({headless:false});
  const page = await browser.newPage();
  console.log('Opening Yapo publish...');
  await page.goto('https://www.yapo.cl/publish', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(4000);
  await page.screenshot({path:'yapo_1.png', fullPage:true});
  console.log('URL:', page.url());
  // Check for category selection
  const content = await page.content();
  console.log('Has Servicios Legales?', content.includes('Servicios Legales') || content.includes('Abogados'));
  console.log('Has Publicar?', content.includes('Publicar'));
  // Try to find category
  const cats = await page.locator('a, button').filter({hasText:'Servicios'}).allTextContents();
  console.log('Servicios cats:', cats.slice(0,10));
  await page.waitForTimeout(5000);
  await browser.close();
}
run().catch(e=>{console.error(e); process.exit(1)});
