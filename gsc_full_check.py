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
    "https://legalhelp.cl/defensa-infracciones-transito",
    "https://legalhelp.cl/limpieza-hoja-de-vida-conductor",
    "https://legalhelp.cl/recurso-apelacion-juzgado-policia-local",
    "https://legalhelp.cl/prescripcion-de-deudas-chile",
    "https://legalhelp.cl/como-salir-de-dicom",
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
        resp = urllib.request.urlopen(req)
        data = json.loads(resp.read())
        v = data.get("inspectionResult", {}).get("indexStatusResult", {})
        print(f"{url}")
        print(f"  Coverage: {v.get('coverageState', 'N/A')}")
        print(f"  Verdict:  {v.get('verdict', 'N/A')}")
        print(f"  Crawled:  {v.get('lastCrawlTime', 'N/A')}")
        print(f"  Indexing: {v.get('indexingState', 'N/A')}")
        print()
    except urllib.error.HTTPError as e:
        print(f"{url}")
        print(f"  ERROR {e.code}: {e.read().decode()}\n")

# Also check sitemap status
print("=== SITEMAP STATUS ===")
req = urllib.request.Request(
    f"https://www.googleapis.com/webmasters/v3/sites/{SITE_ENCODED}/sitemaps",
    headers={"Authorization": f"Bearer {creds.token}"},
)
resp = urllib.request.urlopen(req)
data = json.loads(resp.read())
for sm in data.get("sitemap", []):
    print(f"  {sm.get('path', 'N/A')} - contents: {sm.get('contents', [])}")
