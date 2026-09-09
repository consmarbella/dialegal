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

urls = [
    "https://legalhelp.cl/",
    "https://legalhelp.cl/prescripcion-de-multas-de-transito",
    "https://legalhelp.cl/prescripcion-multas-tag",
    "https://legalhelp.cl/prescripcion-de-deudas-chile",
]

for url in urls:
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
        resp = urllib.request.urlopen(req, timeout=15)
        data = json.loads(resp.read())
        v = data.get("inspectionResult", {}).get("indexStatusResult", {})
        print(f"{url}")
        print(f"  {v.get('coverageState', 'N/A')} | {v.get('verdict', 'N/A')} | crawled: {v.get('lastCrawlTime', 'N/A')}")
    except Exception as e:
        print(f"{url} => ERROR: {e}")
