from google.oauth2 import service_account
from googleapiclient.discovery import build
from datetime import datetime, timedelta

CREDENTIALS_FILE = r"C:\Users\matte\Downloads\dolarexpress-seo-1ad051eee34d.json"
creds = service_account.Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=["https://www.googleapis.com/auth/webmasters"])
webmasters = build("webmasters", "v3", credentials=creds)
site_url = "sc-domain:legalhelp.cl"

for days in [3,7]:
    end = datetime.now().date()
    start = end - timedelta(days=days)
    print(f"\n=== Últimos {days} días ({start} a {end}) ===")
    req = {"startDate": str(start), "endDate": str(end), "dimensions": ["query","page"], "rowLimit": 20, "dataState": "all"}
    try:
        resp = webmasters.searchanalytics().query(siteUrl=site_url, body=req).execute()
        rows = resp.get("rows", [])
        print(f"Total query-page: {len(rows)}")
        for r in rows[:15]:
            q = r["keys"][0]
            p = r["keys"][1].replace("https://legalhelp.cl","")
            clicks = r.get("clicks",0)
            imp = r.get("impressions",0)
            pos = r.get("position",0)
            print(f"  '{q}' -> {p} clicks={clicks} imp={imp} pos={pos:.1f}")
        if not rows:
            print("  (sin datos aún - GSC tarda 48h)")
    except Exception as e:
        print(f"Error: {e}")

# Also check pages with impressions last 7 days
print("\n=== Pages últimos 7 días ===")
try:
    req = {"startDate": str(datetime.now().date()-timedelta(days=7)), "endDate": str(datetime.now().date()), "dimensions": ["page"], "rowLimit": 20}
    resp = webmasters.searchanalytics().query(siteUrl=site_url, body=req).execute()
    for r in resp.get("rows",[])[:10]:
        print(f"  {r['keys'][0].replace('https://legalhelp.cl','')} imp={r.get('impressions',0)} pos={r.get('position',0):.1f}")
except Exception as e:
    print(e)
