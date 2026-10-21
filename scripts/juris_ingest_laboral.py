"""Ingesta one-time del corpus Open Legal Chile (Hugging Face) -> subset laboral.
# Pipeline: filtra las fichas dogmáticas de 'instituciones.jsonl' por área laboral,
# parsea fallo_rector (rol/fecha) y concordancias BCN (cuerpo + artículo),
# y escribe data/jurisprudencia-laboral.json compacto para el runtime del server.
# Uso:  python scripts/juris_ingest_laboral.py  [ruta_al_jsonl]
# El JSONL se descarga una sola vez con huggingface_hub:
#   pip install huggingface_hub
#   python -c "from huggingface_hub import hf_hub_download; \
#     hf_hub_download(repo_id='pablobenavidesj/doctrina-jurisprudencia-chile-training', \
#     filename='data/instituciones.jsonl', repo_type='dataset', local_dir='RUTA_TEMP')"
"""

import json
import os
import re
import sys
from collections import Counter

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DEFAULT_JSONL = os.path.join(os.environ["TEMP"], "opencode", "hf", "data", "instituciones.jsonl")
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "jurisprudencia-laboral.json")

ROL_RE = re.compile(r"Rol\s*N?[°º]?\s*([\d.,p/\-\s][\d.,/p.\-]*\d)[,\s]+(Pleno\s*/\s*Unificación[^\]]*|[^\]]*Unification[^\]]*|Fecha:\s*)?Fecha:(\s*[\d\-/.]+)", re.IGNORECASE)

def parse_fallo_rector(raw: str):
    if not raw:
        return None
    txt = raw.strip("`[]" + chr(13) + chr(10))
    rol_m = re.search(r"Rol\s*N?[°º]?\s*([\d.,\-/p\s]*\d\w?)", txt, re.IGNORECASE)
    fecha_m = re.search(r"Fecha:\s*([\d\-/.]+)", txt)
    extra = []
    if re.search(r"Pleno", txt, re.IGNORECASE):
        extra.append("Pleno")
    if re.search(r"Unificación", txt, re.IGNORECASE):
        extra.append("Unificación de Jurisprudencia")
    sala_m = re.search(r"([\wªº\.\s]+)\s*-\s*2019|Sala\s+([\w\s]+)", txt)
    return {
        "rol": rol_m.group(1).replace(".", "").replace("p", "").strip() if rol_m else "",
        "fecha": fecha_m.group(1) if fecha_m else "",
        "extra": ", ".join(extra),
        "raw": txt.strip()[:160],
    }

NORMA_RE = re.compile(r"Código del Trabajo, Art\.\s*([\d°º]+)|Código del Trabajo,\s*Dictamen\s*([\d/\-]+)|Ley\s*N?[°º]?\s*(\d[\d.]+),? Art\.?\s*([\d°º/\-]*)", re.IGNORECASE)

def parse_normas(concordancias: str):
    out = []
    if not concordancias:
        return out
    for m in re.finditer(r"\[([^\]]+)\]", concordancias):
        ref = m.group(1).strip()
        if not ref:
            continue
        out.append(ref)
    return out

DICTAMEN_RE = re.compile(r"[Bb]cn\s*[-–]\s*([A-ZÁÉÍÓÚÑ¿][^\d]*?)[,\s]*Dictamen?\s*N?[°º]?\s*([\d\-./]+)", re.IGNORECASE)

def parse_dictamen(concordancias: str):
    out = []
    if not concordancias:
        return out
    for m in re.finditer(r"\[([^\]]+)\]", concordancias):
        ref = m.group(1).strip()
        dm = DICTAMEN_RE.search(ref)
        if dm or "dictamen" in ref.lower():
            out.append(ref)
    return out

def main():
    jsonl_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_JSONL
    if not os.path.isfile(jsonl_path):
        print(f"ERROR: no existe {jsonl_path}. Descarga el JSONL primero (ver docstring del script).")
        sys.exit(1)
    subset = []
    motivos = Counter()
    with open(jsonl_path, encoding="utf-8") as f:
        for l in f:
            d = json.loads(l)
            area = str(d.get("area", ""))
            institucion = str(d.get("institucion", ""))
            materia = str(d.get("materia", ""))
            obra = str(d.get("obra", ""))
            blob = f"{area} {institucion} {materia} {obra}".lower()
            if not any(kw in blob for kw in ("laboral", "trabajo", "despido", "finiquito", "tutela", "remuneraci", "cotizaci", "karin", "subordinaci")):
                motivos["fuera_laboral"] += 1
                continue
            # Ficha de calidad: el dataset trae filas con campos corrompidos (texto
            # de contenido en 'institucion' y sin fallo rector). De esas mejor no indexar.
            if len(institucion) > 150 or not institucion:
                motivos["institucion_corrupta"] += 1
                continue
            # Heuristica anti-contenido: una institucion real es un titulo corto,
            # arranca en mayuscula (o cifra) y no lleva puntuacion de prosa.
            # Numeraciones de capitulo al inicio ("3.2.2.2 ", "2. ") y numeros de
            # pagina al final ("3.3 Agendamiento de audiencias   92") son titulos validos:
            # se limpian antes de evaluar corrupcion.
            institucion_limpia = re.sub(r"\s+\d{1,4}\s*$", "", institucion).strip()
            institucion_limpia = re.sub(r"^\d+(?:[.]\d+)*\.?\s+", "", institucion_limpia).strip()
            if re.search(r"\(\d{4}\)|«|“| / ", institucion_limpia):
                motivos["corrupta_cita"] += 1
                continue
            if institucion_limpia[0].islower() or len(institucion_limpia.split()) < 3:
                motivos["institucion_corrupta"] += 1
                continue
            institucion = institucion_limpia
            # Prosa que se colo como titulo (arranca en mayuscula pero es una frase)
            if re.match(r"^(Por |Parte de |Reclamar |Explique |Sentencia del |En todos |Conclusi|Esta ley |La Direcci|De los |Además|Ademas|Sin embargo|Al efecto|Según|Segun|Cabe |De este |De esa |De este modo)", institucion) or institucion.endswith("-") or re.search(r"\s(en la|de la|de el|y la|del |los )\s?\w{0,20}$", institucion):
                motivos["institucion_prosa"] += 1
                continue
            # Fichas sin fallo rector: solo si son fichas dogmáticas sanas (definición
            # con sustancia + normas citadas). Se agregan como fichas de contexto.
            tiene_rector = bool((d.get("fallo_rector") or "").strip())
            definicion = (d.get("definicion") or "").strip()
            if not tiene_rector:
                if len(definicion) < 120 or not (d.get("concordancias") or "").strip():
                    motivos["sin_fallo_rector_debil"] += 1
                    continue
                motivos["aceptada_sin_rector"] += 1
            rec = {
                "id": d.get("id", ""),
                "institucion": institucion,
                "area": area or "Laboral",
                "materia": materia,
                "obra": obra,
                "autor": d.get("autor", ""),
                "definicion": definicion,
                "conFalloRector": tiene_rector,
                "operativaProcesal": (d.get("operativa_procesal") or "").strip()[:400],
                "fallos": parse_dictamen(d.get("concordancias") or ""),
                "falloRector": parse_fallo_rector(d.get("fallo_rector") or "") if tiene_rector else None,
                "normas": parse_normas(d.get("concordancias") or ""),
                "tokens": d.get("tokens_aprox", 0),
                "contenido": (d.get("contenido") or "").strip(),
            }
            subset.append(rec)

    # Dedup por institucion (el dataset trae titan instancias repetidas);
    # se prefiere la instancia con fallo rector o de mayor longitud.
    mejores: dict[str, dict] = {}
    for r in subset:
        k = r["institucion"]
        prev = mejores.get(k)
        if not prev:
            mejores[k] = r
            continue
        si = (1 if prev["falloRector"] else 0, len(prev["contenido"]))
        sn = (1 if r["falloRector"] else 0, len(r["contenido"]))
        if sn > si:
            mejores[k] = r
    subset = list(mejores.values())

    total_tokens = sum(r["tokens"] for r in subset)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"fuente": "Open Legal Chile — pablobenavidesj/doctrina-jurisprudencia-chile-training (Hugging Face)", "generado": __import__("datetime").datetime.date().isoformat() if False else None, "total": len(subset), "fichas": subset}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"OK {len(subset)} fichas laborales -> {OUT} ({os.path.getsize(OUT)//1024} KB, ~{total_tokens} tokens)")
    print("motivos descarte:", dict(motivos.most_common(5)))
    ejemplos = Counter(r["materia"] for r in subset).most_common(8)
    print("materias top:", ejemplos)

if __name__ == "__main__":
    main()
