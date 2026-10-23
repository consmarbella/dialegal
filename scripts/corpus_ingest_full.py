"""Fase 5 - Ingesta COMPLETA del corpus Open Legal Chile (11.858 fichas) por area.

Lee instituciones.jsonl (dataset pablobenavidesj/doctrina-jurisprudencia-chile-training,
Hugging Face) y genera un compacto POR AREA en data/corpus-full/:
  laboral.json | civil.json | familia.json | penal.json | administrativo.json |
  constitucional.json | transversal.json  (Judicial+Procesal+General + otros)

El runtime (jurisprudenciaChile.ts) carga los archivos del area pedida + transversal
SOLO si CORPUS_COMPLETO=true. Con el flag apagado sigue usando la base actual
(data/jurisprudencia-laboral.json).

Las heuristicas de calidad (corrupcion de institucion, prosa como titulo, dedup por
institucion prefiriendo fallo rector) se reutilizan de juris_ingest_laboral.py para
que ambos corpus usen el mismo filtro. `contenido` se recorta a 2500 chars por ficha
(el peso de contenido en el scorer es el mas bajo: C_W=1).

Uso:  python scripts/corpus_ingest_full.py [ruta_al_jsonl]
"""

import json
import os
import re
import sys
from collections import Counter

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
from juris_ingest_laboral import (  # noqa: E402
    parse_fallo_rector,
    parse_dictamen,
    parse_normas,
    DEFAULT_JSONL,
)

OUT_DIR = os.path.join(os.path.dirname(BASE), "data", "corpus-full")
MAX_CONTENIDO = 2500

AREAS_APP = {
    "laboral": {"Laboral", "Derecho del Trabajo (Laboral)"},
    "civil": {"Civil", "Derecho Civil", "Derecho Comercial"},
    "familia": {"Familia"},
    "penal": {"Penal", "Derecho Penal"},
    "administrativo": {"Administrativo", "Derecho Administrativo"},
    "constitucional": {"Constitucional", "Derecho Constitucional"},
}


def slug_for_area(area: str) -> str:
    """Mapea la etiqueta cruda del dataset a un slug de archivo. Los que sobran
    (Judicial, Procesal, General, Derecho Procesal, etc.) van a transversal."""
    area = (area or "").strip()
    for slug, etiquetas in AREAS_APP.items():
        if area in etiquetas:
            return slug
    return "transversal"


def main() -> None:
    jsonl_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_JSONL
    if not os.path.isfile(jsonl_path):
        print(f"ERROR: no existe {jsonl_path}. Descarguelo con hf_hub_download (ver scripts/juris_ingest_laboral.py).")
        sys.exit(1)

    buckets: dict[str, list] = {s: [] for s in list(AREAS_APP) + ["transversal"]}
    motivos: Counter = Counter()
    with open(jsonl_path, encoding="utf-8") as f:
        for l in f:
            d = json.loads(l)
            area = str(d.get("area", ""))
            institucion = str(d.get("institucion", ""))
            materia = str(d.get("materia", ""))
            obra = str(d.get("obra", ""))
            blob = f"{area} {institucion} {materia} {obra}".lower()
            # Excluye las filas explicitamente OTRA area dogmatica conocida cuando
            # el area cruda ya dice de donde viene; el resto lo decide el slug.
            marcadores_no = {
                "ambiental": None,  # los corpus ambientales de HF quedan FUERA (fase futura)
            }
            if any(mo in blob for mo in marcadores_no) and "Judicial" not in area:
                motivos["ambiental_fuera"] += 1
                continue
            # Mismos filtros de calidad que la base laboral.
            if len(institucion) > 150 or not institucion:
                motivos["institucion_corrupta"] += 1
                continue
            institucion_limpia = re.sub(r"\s+\d{1,4}\s*$", "", institucion).strip()
            institucion_limpia = re.sub(r"^\d+(?:[.]\d+)*\.?\s+", "", institucion_limpia).strip()
            if re.search(r"\(\d{4}\)|\u00a7|\"| / ", institucion_limpia):
                motivos["corrupta_cita"] += 1
                continue
            if institucion_limpia[0].islower() or len(institucion_limpia.split()) < 3:
                motivos["institucion_corrupta"] += 1
                continue
            institucion = institucion_limpia
            if re.match(r"^(Por |Parte de |Reclamar |Explique |Sentencia del |En todos |Conclusi|Esta ley |La Direcci|De los |Adem?s|Ademas|Sin embargo|Al efecto|Seg?n|Cabe |De este |De esa |De este modo)", institucion) or institucion.endswith("-") or re.search(r"\s(en la|de la|de el|y la|del |los )\s?\w{0,20}$", institucion):
                motivos["institucion_prosa"] += 1
                continue
            tiene_rector = bool((d.get("fallo_rector") or "").strip())
            definicion = (d.get("definicion") or "").strip()
            if not tiene_rector:
                if len(definicion) < 120 or not (d.get("concordancias") or "").strip():
                    motivos["sin_fallo_rector_debil"] += 1
                    continue
                motivos["aceptada_sin_rector"] += 1
            slug = slug_for_area(area)
            buckets[slug].append({
                "id": d.get("id", ""),
                "institucion": institucion,
                "area": area or slug,
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
                "contenido": (d.get("contenido") or "").strip()[:MAX_CONTENIDO],
            })

    os.makedirs(OUT_DIR, exist_ok=True)
    total_ok = 0
    for slug, arr in buckets.items():
        mejores: dict[str, dict] = {}
        for r in arr:
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
        out = os.path.join(OUT_DIR, f"{slug}.json")
        with open(out, "w", encoding="utf-8") as f:
            json.dump({
                "fuente": "Open Legal Chile - pablobenavidesj/doctrina-jurisprudencia-chile-training (Hugging Face)",
                "total": len(subset),
                "fichas": subset,
            }, f, ensure_ascii=False, separators=(",", ":"))
        total_ok += len(subset)
        print(f"OK {slug}: {len(subset):5d} fichas -> {out} ({os.path.getsize(out) // 1024} KB)")
    print(f"TOTAL {total_ok} fichas | descartes: {dict(motivos.most_common(6))}")


if __name__ == "__main__":
    main()
