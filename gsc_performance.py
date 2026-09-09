import json
from google.oauth2 import service_account
from google.auth.transport.requests import Request
import urllib.request
import urllib.parse
from datetime import datetime, timedelta

CREDS_FILE = r"C:\Users\matte\Downloads\dolarexpress-seo-1ad051eee34d.json"
SITE = "sc-domain:legalhelp.cl"
SITE_ENCODED = urllib.parse.quote(SITE, safe="")

SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]
creds = service_account.Credentials.from_service_account_file(CREDS_FILE, scopes=SCOPES)
creds.refresh(Request())

today = datetime(2026, 8, 27)
end1 = today.strftime("%Y-%m-%d")
start1 = (today - timedelta(days=28)).strftime("%Y-%m-%d")
end2 = (today - timedelta(days=29)).strftime("%Y-%m-%d")
start2 = (today - timedelta(days=56)).strftime("%Y-%m-%d")

def query_gsc(start_date, end_date, dimensions=None):
    body = {
        "startDate": start_date,
        "endDate": end_date,
        "rowLimit": 25,
    }
    if dimensions:
        body["dimensions"] = dimensions
    data = json.dumps(body).encode()
    url = f"https://www.googleapis.com/webmasters/v3/sites/{SITE_ENCODED}/searchAnalytics/query"
    req = urllib.request.Request(url, data=data, headers={
        "Authorization": f"Bearer {creds.token}",
        "Content-Type": "application/json",
    })
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())

print(f"PERIODO ACTUAL: {start1} a {end1}")
print(f"PERIODO ANTERIOR: {start2} a {end2}")
print("=" * 60)

r1 = query_gsc(start1, end1)
r2 = query_gsc(start2, end2)

rows1 = r1.get("rows", [])
rows2 = r2.get("rows", [])

clicks1 = sum(r["clicks"] for r in rows1)
clicks2 = sum(r["clicks"] for r in rows2)
imp1 = sum(r["impressions"] for r in rows1)
imp2 = sum(r["impressions"] for r in rows2)
pos1 = sum(r["position"] * r["impressions"] for r in rows1) / imp1 if imp1 else 0
pos2 = sum(r["position"] * r["impressions"] for r in rows2) / imp2 if imp2 else 0

print(f"\nRESUMEN GENERAL:")
print(f"  Clicks:       {clicks1} (antes: {clicks2}) diff: {clicks1-clicks2:+d}")
print(f"  Impresiones:  {imp1} (antes: {imp2}) diff: {imp1-imp2:+d}")
print(f"  Pos. promedio: {pos1:.1f} (antes: {pos2:.1f})")

print(f"\nTOP 15 PAGINAS (clicks):")
r1p = query_gsc(start1, end1, ["page"])
for row in sorted(r1p.get("rows", []), key=lambda x: x["clicks"], reverse=True)[:15]:
    print(f"  {row['clicks']:>4} clicks | {row['impressions']:>6} imp | pos {row['position']:.1f} | {row['keys'][0]}")

print(f"\nTOP 15 QUERIES (clicks):")
r1q = query_gsc(start1, end1, ["query"])
for row in sorted(r1q.get("rows", []), key=lambda x: x["clicks"], reverse=True)[:15]:
    print(f"  {row['clicks']:>4} clicks | {row['impressions']:>6} imp | pos {row['position']:.1f} | {row['keys'][0]}")

print(f"\nLAS 4 PAGINAS NUEVAS:")
new_slugs = ["prescripcion-de-multas-de-transito", "defensa-infracciones-transito", "limpieza-hoja-de-vida-conductor", "recurso-apelacion-juzgado-policia-local"]
found_any = False
for row in r1p.get("rows", []):
    for slug in new_slugs:
        if slug in row["keys"][0]:
            print(f"  {row['clicks']} clicks | {row['impressions']} imp | pos {row['position']:.1f} | {row['keys'][0]}")
            found_any = True
if not found_any:
    print("  Ninguna de las 4 aparece en datos de GSC (todavia no las crawló)")
