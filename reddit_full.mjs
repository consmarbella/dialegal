import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import Imap from 'imap';
import { simpleParser } from 'mailparser';

chromium.use(stealth());

const email='xaos27@gmail.com';
const pass='Ale2401-';
const username='LegalHelpCL_'+Math.floor(Math.random()*9000+1000);

async function getVerificationCode(){
  return new Promise((resolve, reject)=>{
    const imap = new Imap({
      user: email,
      password: pass,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    });
    imap.once('ready', ()=>{
      imap.openBox('INBOX', false, (err, box)=>{
        if(err) return reject(err);
        // Search for Reddit verification emails from last 10 minutes
        imap.search(['UNSEEN', ['FROM', 'reddit']], (err, results)=>{
          if(err || !results || results.length===0){
            // Try seen also
            imap.search([['FROM','reddit']], (err2, results2)=>{
              if(err2 || !results2 || results2.length===0) return resolve(null);
              const f = imap.fetch(results2.slice(-1), {bodies:''});
              f.on('message', msg=>{
                msg.on('body', stream=>{
                  simpleParser(stream, (err, parsed)=>{
                    if(err) return resolve(null);
                    const body = parsed.text || parsed.html || '';
                    const match = body.match(/https:\/\/www\.reddit\.com\/verify\/[^\s"']+|verify.*?code.*?([A-Z0-9]{6,})/i);
                    console.log('Email body snippet:', body.slice(0,500));
                    resolve(match ? match[0] : null);
                  });
                });
              });
              f.once('error', ()=>resolve(null));
              f.once('end', ()=>{});
            });
            return;
          }
          const f = imap.fetch(results.slice(-1), {bodies:''});
          f.on('message', msg=>{
            msg.on('body', stream=>{
              simpleParser(stream, (err, parsed)=>{
                if(err) return resolve(null);
                const body = parsed.text || parsed.html || '';
                console.log('UNSEEN Reddit email found');
                const match = body.match(/https:\/\/www\.reddit\.com\/verify\/[^\s"']+/);
                resolve(match ? match[0] : body.slice(0,500));
              });
            });
          });
          f.once('error', ()=>resolve(null));
        });
      });
    });
    imap.once('error', e=>{ console.log('IMAP error', e.message); resolve(null); });
    imap.connect();
    setTimeout(()=>{ try{imap.end();}catch{}; resolve(null); }, 15000);
  });
}

async function run(){
  const browser = await chromium.launch({headless:false, args:['--disable-blink-features=AutomationControlled']});
  const context = await browser.newContext({
    userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport:{width:1280, height:800}
  });
  const page = await context.newPage();
  
  console.log(`Creating Reddit ${username}...`);
  await page.goto('https://www.reddit.com/register/', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(4000);
  await page.screenshot({path:'r_full_1.png', fullPage:true});
  
  // Email
  const emailInput = page.locator('input[name="email"]');
  if(await emailInput.count()>0){
    await emailInput.fill(email);
    console.log('Filled email');
    await page.waitForTimeout(800);
    const cont = page.locator('button:has-text("Continue")').first();
    if(await cont.count()>0){ await cont.click(); await page.waitForTimeout(3000); }
  }
  
  // Username
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
  const signup = page.locator('button:has-text("Sign Up")').first();
  if(await signup.count()>0){
    await signup.click();
    console.log('Clicked Sign Up');
    await page.waitForTimeout(6000);
    await page.screenshot({path:'r_full_2.png', fullPage:true});
    console.log('URL after signup:', page.url());
  }
  
  // Check for verification
  await page.waitForTimeout(3000);
  let content = await page.content();
  if(content.includes('verify') || content.includes('check your email')){
    console.log('Verification required, checking Gmail via IMAP...');
    for(let i=0;i<6;i++){
      console.log(`IMAP check ${i+1}/6...`);
      const code = await getVerificationCode();
      if(code){
        console.log('Found verification:', code);
        if(code.startsWith('http')){
          console.log('Opening verification link...');
          await page.goto(code, {waitUntil:'domcontentloaded'});
          await page.waitForTimeout(3000);
          await page.screenshot({path:'r_full_verified.png', fullPage:true});
          break;
        }
      }
      await new Promise(r=>setTimeout(r,10000));
    }
  }
  
  console.log('Final URL:', page.url());
  await page.screenshot({path:'r_full_final.png', fullPage:true});
  
  // Try to answer existing posts if logged in
  if(page.url().includes('reddit.com') && !page.url().includes('register')){
    console.log('Logged in, trying to answer posts...');
    const targets = [
      'https://www.reddit.com/r/chile/comments/1by6q5e/como_consultar_multas_grauitamente/',
      'https://www.reddit.com/r/chile_autos/comments/1s4g0x2/multa_por_circular_sin_tag_teniendo_tag/'
    ];
    for(let url of targets){
      console.log(`Opening ${url}...`);
      await page.goto(url, {waitUntil:'domcontentloaded'});
      await page.waitForTimeout(4000);
      await page.screenshot({path:`r_answer_${url.split('/')[5]}.png`, fullPage:true});
      // Try to find comment box
      const commentBox = page.locator('[contenteditable="true"], textarea[placeholder*="comment"], div[role="textbox"]').first();
      if(await commentBox.count()>0){
        console.log(`Found comment box for ${url}`);
        await commentBox.click();
        await page.keyboard.type(`Hola! Para consultar multas gratis puedes hacerlo en PasasteSinTag.cl con tu patente o en Registro Civil con tu clave única (certificado de multas no pagadas). Si tienes multas TAG de más de 3 años, puedes prescribirlas y eliminarlas sin pagar (Ley 18.287 Art 24). En LegalHelp las revisamos por $15.000 y redactamos el escrito por $10.000 por juzgado. Guías: https://legalhelp.cl/consultar-multas-tag y https://legalhelp.cl/prescripcion-multas-tag WhatsApp +56967658939`, {delay:15});
        await page.waitForTimeout(1000);
        const commentBtn = page.locator('button:has-text("Comment"), button:has-text("Comentar")').first();
        if(await commentBtn.count()>0 && !(await commentBtn.isDisabled())){
          await commentBtn.click();
          console.log(`Posted comment to ${url}`);
          await page.waitForTimeout(3000);
        }
      } else {
        console.log(`No comment box for ${url}, maybe login required`);
      }
      await page.waitForTimeout(2000);
    }
  }
  
  await page.waitForTimeout(10000);
  await browser.close();
}
run().catch(e=>{console.error(e); process.exit(1)});
