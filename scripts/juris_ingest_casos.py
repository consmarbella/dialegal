"""Ingesta de CASOS (fallo/dictamen + doctrina) desde el paquete local Open Legal Chile
# y/o Hugging Face -> data/jurisprudencia-casos.json.
#
# Fuentes (en orden de preferencia):
#  1. site-packages/pjud_connector.py -> FALLOS_RECTORES_CHILE (fallo rector + doctrina)
#  2. site-packages/data/jurisprudencia/tc_sentencias_2anios.jsonl (TC, doctrina inclusive)
#  3. [opcional] jsonl cosechado de CS si existe (cs_sentencias_2anios.jsonl)
#
# Uso: python scripts/juris_ingest_casos.py
"""
import importlib.util
import json
import os
import re
import sys
from collections import Counter

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "jurisprudencia-casos.json")

KW = ("laboral", "trabajo", "despido", "indi[cv]to", "finiquito", "tutela", "remuneraci",
      "cotizaci", "karin", "subordinaci", "acoso", "fuero maternal", "sanción municipal",
      "indemnizaci.*labor", "juzgado de letras del trabajo", "ley karin", "despido injustific",
      "polic[íi]a local", "jpl", "contrata", "honorarios.*labor")

def esLaboral(texto: str) -> bool:
    t = texto.lower()
    return any(re.search(k, t) for k in KW)

def car(s) -> str:
    return s or ""

def cargarFallosRectores():
    """Importa FALLOS_RECTORES_CHILE desde el openlegal ya instalado."""
    spec = importlib.util.find_spec("pjud_connector")
    if not spec:
        return []
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return getattr(mod, "FALLOS_RECTORES_CHILE", [])

def main():
    casos = []
    motivos = Counter()

    # 1) Fallos rectores CS (hardcoded en el conector, siempre disponibles)
    for f in cargarFallosRectores():
        caso = {
            "tipo": "fallo_rector",
            "tribunal": f.get("tribunal", ""),
            "sala": f.get("sala", ""),
            "rol": f.get("rol", ""),
            "fecha": f.get("fecha", ""),
            "caratula": f.get("caratula", ""),
            "materia": f.get("materia", ""),
            "doctrina": f.get("doctrina", ""),
            "normas": f.get("normas", ""),
            "link": f.get("link", ""),
        }
        if esLaboral(f"{car(caso['materia'])} {car(caso['doctrina'])} {car(caso['caratula'])}") or esLaboral(caso["materia"]):
            casos.append(caso)
        motivos["fallo_rector"] += 1

    # 2) Corpus CS/TC reciente (con doctrina cuando la hay)
    ruta_sp = None
    try:
        spec = importlib.util.find_spec("pjud_connector")
        ruta_sp = os.path.dirname(spec.origin)
    except Exception:
        pass
    if ruta_sp:
        jdir = os.path.join(ruta_sp, "data", "jurisprudencia")
        for nombre in ("cs_sentencias_2anios.jsonl", "cs_sentencias.jsonl",
                       "tc_sentencias_2anios.jsonl", "tc_sentencias.jsonl"):
            path = os.path.join(jdir, nombre)
            if not os.path.isfile(path):
                continue
            regs = 0; con_doctrina = 0; ok = 0
            with open(path, encoding="utf-8") as file:
                for linea in file:
                    regs += 1
                    try:
                        d = json.loads(linea)
                    except Exception:
                        continue
                    det = d.get("detalle") or {}
                    doctrina = det.get("Doctrina") or d.get("doctrina") or ""
                    if isinstance(doctrina, str):
                        doctrina = doctrina.strip()
                    if doctrina.lower() in ("none", ""):
                        doctrina = ""
                    blob = f"{d.get('caratula','')} {d.get('materia','')} {d.get('tipo','')} {doctrina} {det.get('Palabras clave','')}"
                    if not esLaboral(blob):
                        motivos["no_laboral_tc_cs"] += 1
                        continue
                    if doctrina.lower() in ("none", "", "null"):
                        doctrina = ""
                    casos.append({
                        "tipo": "caso",
                        "fuente_corpus": nombre.replace(".jsonl", ""),
                        "tribunal": d.get("tribunal", ""),
                        "sala": d.get("sala", ""),
                        "rol": d.get("rol", ""),
                        "fecha": d.get("fecha", ""),
                        "caratula": d.get("caratula", "")[:220],
                        "materia": d.get("materia", "") or d.get("tipo", ""),
                        "doctrina": doctrina,
                        "normas": det.get("Normas") or "",
                        "link": d.get("link_pdf") or d.get("link") or "",
                    })
                    con_doctrina += 1 if doctrina else 0
                    ok += 1
            print(f"{nombre}: regs={regs} laborales={ok} conDoctrina={con_doctrina}")

    dedup = {}
    for c in casos:
        dedup[c["rol"]] = c
    final = list(dedup.values())
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as main_file:
        json.dump({"fuente": "Open Legal Chile (paquete local pjud_connector + data/jurisprudencia)",
                   "total": len(final), "casos": final}, main_file, ensure_ascii=False, separators=(",", ":"))
    print(f"OK {len(final)} casos laborales -> {OUT} ({os.path.getsize(OUT)//1024} KB)")
    print("tipos:", Counter(c['tipo'] for c in final))

if __name__ == "__main__":
    main()
