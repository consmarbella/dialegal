from google.oauth2 import service_account
from googleapiclient.discovery import build
import json

CREDENTIALS_FILE = r"C:\Users\matte\Downloads\dolarexpress-seo-1ad051eee34d.json"
creds = service_account.Credentials.from_service_account_file(
    CREDENTIALS_FILE, scopes=["https://www.googleapis.com/auth/webmasters"])
webmasters = build("webmasters", "v3", credentials=creds)

site_url = "sc-domain:legalhelp.cl"

# Get queries with impressions but low position (opportunities)
request = {
    "startDate": "2026-08-17",
    "endDate": "2026-09-14",
    "dimensions": ["query", "page"],
    "rowLimit": 200,
    "dataState": "final",
    "dimensionFilterGroups": [{
        "filters": [{
            "dimension": "impressions",
            "operator": "gt",
            "expression": "0"
        }]
    }]
}
response = webmasters.searchanalytics().query(siteUrl=site_url, body=request).execute()
rows = response.get("rows", [])
print(f"Total query-page pairs: {len(rows)}")
print()

# Sort by impressions desc
rows.sort(key=lambda x: x.get("impressions", 0), reverse=True)
for row in rows[:50]:
    query = row["keys"][0]
    page = row["keys"][1]
    clicks = row.get("clicks", 0)
    impressions = row.get("impressions", 0)
    position = row.get("position", 0)
    print(f'  "{query}" -> {page.split("cl")[1] if "cl" in page else page} | imp={impressions} pos={position:.0f}')
