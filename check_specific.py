from google.oauth2 import service_account
from googleapiclient.discovery import build

CREDENTIALS_FILE = r"C:\Users\matte\Downloads\dolarexpress-seo-1ad051eee34d.json"
creds = service_account.Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=["https://www.googleapis.com/auth/webmasters"])
webmasters = build("webmasters", "v3", credentials=creds)
site_url = "sc-domain:legalhelp.cl"

# Query for specific page queries
for page in ["https://legalhelp.cl/prescripcion-multas-tag", "https://legalhelp.cl/prescripcion-de-multas-de-transito"]:
    print(f"\n=== {page} ===")
    req = {
        "startDate": "2026-08-17",
        "endDate": "2026-09-14",
        "dimensions": ["query"],
        "dimensionFilterGroups": [{"filters": [{"dimension": "page", "operator": "equals", "expression": page}]}],
        "rowLimit": 20
    }
    try:
        resp = webmasters.searchanalytics().query(siteUrl=site_url, body=req).execute()
        rows = resp.get("rows", [])
        print(f"Queries for this page: {len(rows)}")
        for r in rows:
            print(f"  {r['keys'][0]} imp={r.get('impressions',0)} pos={r.get('position',0):.1f}")
        if not rows:
            print("  (no queries - 0 impressions)")
    except Exception as e:
        print(f"Error: {e}")

# Also check index status via sitemaps
print("\n=== Sitemap status ===")
try:
    sitemaps = webmasters.sitemaps().list(siteUrl=site_url).execute()
    for s in sitemaps.get("sitemap", []):
        print(f"{s['path']}: submitted={s.get('contents',[{}])[0].get('submitted','?')} indexed={s.get('contents',[{}])[0].get('indexed','?')} pending={s.get('isPending')}")
except Exception as e:
    print(e)
