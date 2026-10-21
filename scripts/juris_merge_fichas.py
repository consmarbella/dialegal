"""Procesa las fichas .md de jurisprudencia_cs (2025/2026) descargadas de HF y
# las mezcla en data/jurisprudencia-casos.json (dedup por rol, fichas ganan).
#
# Solo se quedan fichas LABORALES (recurso "(LABORAL)").
# Uso: python scripts/juris_merge_fichas.py [ruta_jurisprudencia_cs]
"""
import json
import os
import re
import sys
from collections import Counter

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CASOS_OUT = os.path.join(BASE, "data", "jurisprudencia-casos.json")
CS_DIR = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\matte\AppData\Local\Temp\opencode\hf\jurisprudencia_cs"

KW_LABORAL = ("laboral", "despido", "indi[cv]to", "finiquito", "tutela", "remuneraci", "cotizaci",
              "karin", "subordinaci", "acoso", "fuero maternal", "juzgado de letras del trabajo",
              "ley bustos", "needs de la empresa", "dano moral", "dan[iy]o moral")

def esLaboral(texto: str) -> bool:
    t = texto.lower()
    return any(re.search(k, t) for k in KW_LABORAL)

# Campos clave-valor de la ficha: "- **Campo:** valor"; la linea de Rol puede
# traer varios pares seguidos ("- **Rol:** X ? **Era:** Y ? **Fecha:** Z").
RE_Linea = re.compile(r"^-\s*\*\*(.+?)\*\*\s*[:?]?\s*(.*)$")
RE_Par = re.compile(r"\*\*(.+?):\*\*\s*([^*]*)")
RE_FECHA = re.compile(r"\d{4}-\d{2}-\d{2}")

def parseFicha(md: str) -> dict:
    campos = {}
    # La primera linea (sin #) suele ser la caratula
    for linea in md.splitlines():
        s = linea.strip()
        if not s or s.startswith(">") or s.startswith("[") or s.startswith("Cita:"):
            continue
        if s.startswith("# "):
            campos.setdefault("Caratula", s[2:].strip())
            continue
        pares = RE_Par.findall(s)
        if pares:
            for k, v in pares:
                k = k.strip().rstrip(":")
                v = v.strip().rstrip("?").strip()
                if not v or v.lower() == "none":
                    if k == "Rol":
                        v = ""
                    else:
                        continue
                if k == "Era":
                    continue
                if k == "Fecha" and not RE_FECHA.fullmatch(v):
                    # Fecha echa en la misma linea con asteriscos: reintentar con regex fecha
                    m2 = RE_FECHA.search(s)
                    if m2:
                        campos["Fecha"] = m2.group(0)
                    continue
                campos[k] = v
        else:
            k, sep, v = s.partition(":**")
            if not sep:
                k = s
                v = ""
            # Fallback sin lista: "- **Tribunal:** ..." ya cubierto arriba
            if k.startswith("- **"):
                k = k[4:]
            k = k.strip().rstrip(":")
            v = v.strip().rstrip("?").strip()
            if k in ("Caratula",) and not campos.get("Caratula"):
                campos["Caratula"] = k if not v else campos["Caratula"]
            if k and v and v.lower() != "none":
                campos[k] = v
        if len(campos) > 10:
            break
    return campos

def main():
    if not os.path.isdir(CS_DIR):
        print(f"NO_DIREC {CS_DIR}")
        return 1
    fichas_ok = []
    total = 0
    laborales = 0
    for raiz, _, archivos in os.walk(CS_DIR):
        for a in archivos:
            if not a.endswith(".md"):
                continue
            total += 1
            path = os.path.join(raiz, a)
            try:
                with open(path, encoding="utf-8", errors="replace") as f:
                    md = f.read()
            except OSError:
                continue
            if "LABORAL" not in md.upper():
                continue
            campos = parseFicha(md)
            recurso = campos.get("Recurso", "") or campos.get("Tipo de Recurso", "")
            if "LABORAL" not in recurso.upper():
                continue
            rol = (campos.get("Rol", "") or os.path.splitext(a)[0]).strip("·•? \t")
            caratula = campos.get("Caratula", "") or campos.get("Carátula", "")
            blob = f"{caratula} {recurso} {campos.get('Materia', '')} {md[:500]}"
            if not esLaboral(blob):
                continue
            laborales += 1
            trib = campos.get("Tribunal", "Corte Suprema")
            if "—" in trib or " - " in trib:
                partes = re.split(r"\s*[—-]\s+", trib, maxsplit=1)
                tribunal_s = partes[0].strip()
                sala_s = (partes[1].strip() if len(partes) > 1 else "").title()
            else:
                tribunal_s = trib.strip()
                sala_s = ""
            sala_final = sala_s or campos.get("Tribunal de origen", "")
            fichas_ok.append({
                "tipo": "ficha_cs",
                "archivo": os.path.relpath(path, CS_DIR),
                "tribunal": tribunal_s,
                "sala": sala_final,
                "rol": rol,
                "fecha": campos.get("Fecha", ""),
                "caratula": caratula[:220],
                "materia": recurso[:80],
                "doctrina": campos.get("Resultado", ""),
                "normas": campos.get("Publicación", "") or campos.get("Publicacion", ""),
                "link": f"https://juris.pjud.cl/busqueda?Corte_Suprema&rol={rol.replace(' ', '%20')}" if rol else "https://juris.pjud.cl",
            })
    print(f"escaneadas={total} laborales={laborales} usables={len(fichas_ok)}")

    # Mezclar con el corpus de casos existente
    data = {"fuente": "", "total": 0, "casos": []}
    if os.path.isfile(CASOS_OUT):
        with open(CASOS_OUT, encoding="utf-8") as f:
            data = json.load(f)
    existente = {c.get("rol", ""): c for c in data.get("casos", [])}
    nuevos = 0
    for f in fichas_ok:
        r = f.get("rol", "")
        existente[r] = f
        nuevos += 1
    casos = list(existente.values())
    data["fuente"] = "Open Legal Chile (paquete local + HD dataset HF fichas CS 2025/2026)"
    data["total"] = len(casos)
    data["casos"] = casos
    os.makedirs(os.path.dirname(CASOS_OUT), exist_ok=True)
    with open(CASOS_OUT, "w", encoding="utf-8") as out:
        json.dump(data, out, ensure_ascii=False, separators=(",", ":"))
    print(f"OK total={len(casos)} (+{nuevos} fichas) -> {CASOS_OUT} ({os.path.getsize(CASOS_OUT)//1024} KB)")
    print("tipos:", Counter(c.get("tipo", "?") for c in casos))
    return 0

if __name__ == "__main__":
    sys.exit(main())
