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

def query_gsc(body):
    data = json.dumps(body).encode()
    url = f"https://www.googleapis.com/webmasters/v3/sites/{SITE_ENCODED}/searchAnalytics/query"
    req = urllib.request.Request(url, data=data, headers={
        "Authorization": f"Bearer {creds.token}",
        "Content-Type": "application/json",
    })
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())

# Todas las queries con impresiones (sin filtro)
print("=== TODAS LAS QUERIES CON IMPRESIONES (ultimos 28 dias) ===")
r = query_gsc({
    "startDate": "2026-07-30",
    "endDate": "2026-08-27",
    "dimensions": ["query"],
    "rowLimit": 100,
})
for row in sorted(r.get("rows", []), key=lambda x: x["impressions"], reverse=True):
    print(f"  {row['impressions']:>4} imp | {row['clicks']} clicks | pos {row['position']:.1f} | {row['keys'][0]}")

# Buscar queries relacionadas con multas, TAG, transito
print("\n=== QUERIES RELACIONADAS: multa, tag, transito, prescripcion ===")
keywords = ["multa", "tag", "transito", "prescripcion", "conductor", "licencia", "hoja de vida"]
for row in r.get("rows", []):
    q = row["keys"][0].lower()
    if any(k in q for k in keywords):
        print(f"  {row['impressions']:>4} imp | {row['clicks']} clicks | pos {row['position']:.1f} | {row['keys'][0]}")

# Buscar en paginas que contengan multas/tag
print("\n=== PAGINAS CON IMPRESIONES QUE CONTIENEN 'multas' o 'tag' ===")
rp = query_gsc({
    "startDate": "2026-07-30",
    "endDate": "2026-08-27",
    "dimensions": ["page"],
    "rowLimit": 100,
})
for row in rp.get("rows", []):
    u = row["keys"][0].lower()
    if any(k in u for k in ["multa", "tag", "transito", "prescripcion-de-multas"]):
        print(f"  {row['impressions']:>4} imp | {row['clicks']} clicks | pos {row['position']:.1f} | {row['keys'][0]}")
