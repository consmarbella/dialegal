import { chromium } from 'playwright';
const email='xaos27@gmail.com';
const pass='Ale2401-';
async function run(){
  const browser = await chromium.launch({headless:false});
  const page = await browser.newPage();
  console.log('Opening Reddit signup...');
  await page.goto('https://www.reddit.com/register/', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(3000);
  await page.screenshot({path:'reddit_1.png', fullPage:true});
  console.log('URL:', page.url());
  // Try to fill email
  const emailInput = page.locator('input[name="email"], input[type="email"]').first();
  if(await emailInput.count()>0){
    console.log('Filling email...');
    await emailInput.fill(email);
    await page.waitForTimeout(1000);
  } else {
    console.log('Email input not found');
    const inputs = await page.locator('input').all();
    console.log('Inputs:', inputs.length);
    for(let i=0;i<Math.min(inputs.length,5);i++){
      const inp = inputs[i];
      console.log(`Input ${i}:`, await inp.getAttribute('name'), await inp.getAttribute('type'), await inp.getAttribute('placeholder'));
    }
  }
  await page.waitForTimeout(2000);
  await page.screenshot({path:'reddit_2.png', fullPage:true});
  await page.waitForTimeout(5000);
  await browser.close();
}
run().catch(e=>{console.error(e);process.exit(1)});
