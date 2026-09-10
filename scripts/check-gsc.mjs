import { google } from 'googleapis';
import { readFileSync } from 'fs';

const key = JSON.parse(readFileSync('C:\\Users\\matte\\Downloads\\dolarexpress-seo-1ad051eee34d.json', 'utf-8'));
const auth = new google.auth.GoogleAuth({
  credentials: key,
  scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
});
const sc = google.searchconsole({ version: 'v1', auth });

async function main() {
  // Top pages by clicks
  const res = await sc.searchanalytics.query({
    requestBody: {
      startDate: '2026-08-01',
      endDate: '2026-09-09',
      dimensions: ['page'],
      rowLimit: 20,
      dataState: 'final'
    },
    siteUrl: 'sc-domain:legalhelp.cl'
  });
  console.log('=== TOP PAGES (ago-sep 2026) ===');
  (res.data.rows || []).forEach(r => {
    console.log(`${r.keys[0]} | Clicks: ${r.clicks} | Imp: ${r.impressions} | Pos: ${r.position?.toFixed(1)}`);
  });
}

main().catch(e => console.error('ERROR:', e.message));
