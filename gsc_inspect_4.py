import json
import google.auth
from google.oauth2 import service_account
from google.auth.transport.requests import Request
import urllib.request

CREDS_FILE = r"C:\Users\matte\Downloads\dolarexpress-seo-1ad051eee34d.json"
SITE = "sc-domain:legalhelp.cl"

URLS = [
    "https://legalhelp.cl/prescripcion-de-multas-de-transito",
    "https://legalhelp.cl/defensa-infracciones-transito",
    "https://legalhelp.cl/limpieza-hoja-de-vida-conductor",
    "https://legalhelp.cl/recurso-apelacion-juzgado-policia-local",
]

SCOPES = ["https://www.googleapis.com/auth/webmasters"]
creds = service_account.Credentials.from_service_account_file(CREDS_FILE, scopes=SCOPES)
creds.refresh(Request())

for url in URLS:
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
        print(f"\n{'='*60}")
        print(f"URL: {url}")
        print(f"  Coverage state: {verdict.get('coverageState', 'N/A')}")
        print(f"  Crawled as:     {verdict.get('crawledAs', 'N/A')}")
        print(f"  robots.txt:     {verdict.get('robotsTxtState', 'N/A')}")
        print(f"  Indexing state:  {verdict.get('indexingState', 'N/A')}")
        print(f"  Page fetch:     {verdict.get('pageFetchState', 'N/A')}")
        print(f" Verdict:        {verdict.get('verdict', 'N/A')}")
        print(f"  last_crawl:     {verdict.get('lastCrawlTime', 'N/A')}")
    except urllib.error.HTTPError as e:
        print(f"\nURL: {url}")
        print(f"  ERROR {e.code}: {e.read().decode()}")
