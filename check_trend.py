from google.oauth2 import service_account
from googleapiclient.discovery import build
from datetime import datetime, timedelta

CREDENTIALS_FILE = r"C:\Users\matte\Downloads\dolarexpress-seo-1ad051eee34d.json"
creds = service_account.Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=["https://www.googleapis.com/auth/webmasters"])
webmasters = build("webmasters", "v3", credentials=creds)
site_url = "sc-domain:legalhelp.cl"

for label, days in [("28 días",28),("7 días",7),("3 días",3)]:
    end = datetime.now().date()
    start = end - timedelta(days=days)
    req = {"startDate": str(start), "endDate": str(end), "dimensions": ["page"], "rowLimit": 10}
    resp = webmasters.searchanalytics().query(siteUrl=site_url, body=req).execute()
    rows = resp.get("rows", [])
    total_imp = sum(r.get("impressions",0) for r in rows)
    total_clicks = sum(r.get("clicks",0) for r in rows)
    print(f"{label} ({start} a {end}): {len(rows)} páginas, {total_imp} impresiones, {total_clicks} clicks")
    for r in rows[:5]:
        print(f"  {r['keys'][0].replace('https://legalhelp.cl','') or '/'} imp={r.get('impressions',0)}")

# Check sitemap
print("\nSitemap:")
try:
    sitemaps = webmasters.sitemaps().list(siteUrl=site_url).execute()
    for s in sitemaps.get("sitemap", []):
        c = s.get("contents",[{}])[0] if s.get("contents") else {}
        print(f"  {s['path']}: submitted={c.get('submitted',0)} indexed={c.get('indexed',0)} pending={s.get('isPending')}")
except Exception as e:
    print(e)
