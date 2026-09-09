import json
from google.oauth2 import service_account
from google.auth.transport.requests import Request
import urllib.request
import urllib.parse

CREDS_FILE = r"C:\Users\matte\Downloads\dolarexpress-seo-1ad051eee34d.json"
SITE = "sc-domain:legalhelp.cl"
SITE_ENCODED = urllib.parse.quote(SITE, safe="")

SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]
creds = service_account.Credentials.from_service_account_file(CREDS_FILE, scopes=SCOPES)
creds.refresh(Request())

# Check indexing status of prescripcion-multas-tag variants
urls_to_check = [
    "https://legalhelp.cl/prescripcion-multas-tag",
    "https://legalhelp.cl/prescripcion-de-multas-de-transito",
]

for url in urls_to_check:
    body = json.dumps({"inspectionUrl": url, "siteUrl": SITE}).encode()
    req = urllib.request.Request(
        "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
        data=body,
        headers={
            "Authorization": f"Bearer {creds.token}",
            "Content-Type": "application/json",
        },
    )
    try:
        resp = urllib.request.urlopen(req)
        data = json.loads(resp.read())
        verdict = data.get("inspectionResult", {}).get("indexStatusResult", {})
        print(f"\nURL: {url}")
        print(f"  Coverage: {verdict.get('coverageState', 'N/A')}")
        print(f"  Verdict:  {verdict.get('verdict', 'N/A')}")
        print(f"  Crawled:  {verdict.get('crawledAs', 'N/A')}")
        print(f"  Indexing: {verdict.get('indexingState', 'N/A')}")
        print(f"  Last crawl: {verdict.get('lastCrawlTime', 'N/A')}")
        print(f"  robots.txt: {verdict.get('robotsTxtState', 'N/A')}")
        print(f"  Page fetch: {verdict.get('pageFetchState', 'N/A')}")
    except urllib.error.HTTPError as e:
        print(f"\nURL: {url}")
        print(f"  ERROR {e.code}: {e.read().decode()}")

# Also search GSC for any queries/pages containing "tag"
print("\n\n=== QUERIES CON 'tag' ===")
body = json.dumps({
    "startDate": "2026-07-30",
    "endDate": "2026-08-27",
    "dimensions": ["query"],
    "rowLimit": 100,
}).encode()
req = urllib.request.Request(
    f"https://www.googleapis.com/webmasters/v3/sites/{SITE_ENCODED}/searchAnalytics/query",
    data=body,
    headers={
        "Authorization": f"Bearer {creds.token}",
        "Content-Type": "application/json",
    },
)
resp = urllib.request.urlopen(req)
data = json.loads(resp.read())
for row in data.get("rows", []):
    q = row["keys"][0].lower()
    if "tag" in q or "prescripcion" in q or "multa" in q:
        print(f"  {row['impressions']:>4} imp | {row['clicks']} clicks | pos {row['position']:.1f} | {row['keys'][0]}")

print("\n=== PAGINAS CON 'tag' ===")
body = json.dumps({
    "startDate": "2026-07-30",
    "endDate": "2026-08-27",
    "dimensions": ["page"],
    "rowLimit": 100,
}).encode()
req = urllib.request.Request(
    f"https://www.googleapis.com/webmasters/v3/sites/{SITE_ENCODED}/searchAnalytics/query",
    data=body,
    headers={
        "Authorization": f"Bearer {creds.token}",
        "Content-Type": "application/json",
    },
)
resp = urllib.request.urlopen(req)
data = json.loads(resp.read())
for row in data.get("rows", []):
    u = row["keys"][0].lower()
    if "tag" in u or "prescripcion" in u:
        print(f"  {row['impressions']:>4} imp | {row['clicks']} clicks | pos {row['position']:.1f} | {row['keys'][0]}")
