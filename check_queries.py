from google.oauth2 import service_account
from googleapiclient.discovery import build
import json

CREDENTIALS_FILE = r"C:\Users\matte\Downloads\dolarexpress-seo-1ad051eee34d.json"
creds = service_account.Credentials.from_service_account_file(
    CREDENTIALS_FILE, scopes=["https://www.googleapis.com/auth/webmasters"])
webmasters = build("webmasters", "v3", credentials=creds)

site_url = "sc-domain:legalhelp.cl"

# Get ALL queries
request = {
    "startDate": "2026-08-17",
    "endDate": "2026-09-14",
    "dimensions": ["query"],
    "rowLimit": 100,
    "dataState": "final"
}
response = webmasters.searchanalytics().query(siteUrl=site_url, body=request).execute()
rows = response.get("rows", [])
print(f"Total queries: {len(rows)}")
print()
for row in rows:
    query = row["keys"][0]
    clicks = row.get("clicks", 0)
    impressions = row.get("impressions", 0)
    position = row.get("position", 0)
    print(f'  "{query}" | clicks={clicks} imp={impressions} pos={position:.1f}')
