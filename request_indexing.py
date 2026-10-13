"""Request indexing for legalhelp.cl pages via Google Indexing API."""

from google.oauth2 import service_account
from googleapiclient.discovery import build
import json

CREDENTIALS_FILE = r"C:\Users\matte\Downloads\dolarexpress-seo-1ad051eee34d.json"

URLS = [
    "https://legalhelp.cl/",
    "https://legalhelp.cl/prescripcion-multas-tag",
    "https://legalhelp.cl/prescripcion-de-multas-de-transito",
    "https://legalhelp.cl/prescripcion-multas/santiago",
    "https://legalhelp.cl/prescripcion-multas/maipu",
    "https://legalhelp.cl/prescripcion-multas/la-florida",
    "https://legalhelp.cl/prescripcion-multas/providencia",
    "https://legalhelp.cl/prescripcion-multas/las-condes",
    "https://legalhelp.cl/prescripcion-multas/quilicura",
    "https://legalhelp.cl/prescripcion-multas/puente-alto",
    "https://legalhelp.cl/prescripcion-de-deudas-chile",
    "https://legalhelp.cl/calculadora-prescripcion-multas",
    "https://legalhelp.cl/prescripcion-multas/nunoa",
    "https://legalhelp.cl/prescripcion-multas/vitacura",
    "https://legalhelp.cl/prescripcion-multas/estacion-central",
    "https://legalhelp.cl/prescripcion-multas/penalolen",
    "https://legalhelp.cl/prescripcion-multas/el-bosque",
    "https://legalhelp.cl/prescripcion-multas/macul",
    "https://legalhelp.cl/prescripcion-multas/recoleta",
    "https://legalhelp.cl/prescripcion-multas/huechuraba",
    "https://legalhelp.cl/prescripcion-multas/conchali",
    "https://legalhelp.cl/prescripcion-multas/cerrillos",
    "https://legalhelp.cl/prescripcion-multas/pudahuel",
    "https://legalhelp.cl/prescripcion-multas/cerro-navia",
    "https://legalhelp.cl/prescripcion-multas/lo-espejo",
    "https://legalhelp.cl/prescripcion-multas/lo-barnechea",
    "https://legalhelp.cl/prescripcion-multas/independencia",
    "https://legalhelp.cl/prescripcion-multas/la-reina",
    "https://legalhelp.cl/prescripcion-multas/renca",
    "https://legalhelp.cl/prescripcion-multas/vina-del-mar",
]

def main():
    creds = service_account.Credentials.from_service_account_file(
        CREDENTIALS_FILE,
        scopes=["https://www.googleapis.com/auth/indexing"]
    )
    service = build("indexing", "v3", credentials=creds)

    success = 0
    errors = 0

    for url in URLS:
        body = {"url": url, "type": "URL_UPDATED"}
        try:
            resp = service.urlNotifications().publish(body=body).execute()
            print(f"OK: {url} -> {resp.get('urlNotificationMetadata', {}).get('latestUpdate', {}).get('notifyTime', 'sent')}")
            success += 1
        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg or "quota" in error_msg.lower():
                print(f"QUOTA EXCEEDED after {success} URLs. Google limits ~200 requests/day.")
                break
            print(f"ERROR: {url} -> {error_msg}")
            errors += 1

    print(f"\nDone: {success} submitted, {errors} errors")

if __name__ == "__main__":
    main()
