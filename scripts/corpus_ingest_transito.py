"""Ingesta reproducible de data/corpus-full/transito.json desde fuentes oficiales verificadas:
1. XML oficial de Ley Chile (BCN):
   - Ley N° 18.290 (idNorma=29708): Ley de Tránsito
   - Ley N° 18.287 (idNorma=29705): Procedimiento ante los Juzgados de Policía Local
   - Ley N° 15.231 (idNorma=28104): Organización y Atribuciones de los Juzgados de Policía Local
   - Ley N° 18.490 (idNorma=29893): Seguro Obligatorio de Accidentes Personales (SOAP)
2. Artículos doctrinales arbitrados de revistas jurídicas chilenas en site-packages/data/
   (RChD PUC, RChDP UDP, RDPUCV, RDUACh, RDUCN) con resumen/abstract sustantivo sobre
   Ley 18.290 / Ley 18.287 / Policía Local.
3. Ficha con fallo rector de culpa infraccional (Ley 18.290 Art. 167) en civil.json.

Regla de honestidad: 0 roles inventados, 0 textos inventados. Las fichas normativas BCN
llevan falloRector=None y conFalloRector=False.
"""

import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(BASE_DIR, "data", "corpus-full", "transito.json")

LEYES_BCN = [
    ("18.290", 29708, "Ley N° 18.290 de Tránsito"),
    ("18.287", 29705, "Ley N° 18.287 sobre Procedimiento ante los Juzgados de Policía Local"),
    ("15.231", 28104, "Ley N° 15.231 sobre Organización y Atribuciones de los Juzgados de Policía Local"),
    ("18.490", 29893, "Ley N° 18.490 sobre Seguro Obligatorio de Accidentes Personales (SOAP)"),
]

INFINITIVO_START = re.compile(
    r"^(chequear|atender|ejercer|entregar|publicar|canalizar|supervisar|verificar|registrar|remitir|"
    r"administrar|coordinar|llevar|mantener|cumplir|controlar|informar|emitir|confeccionar|otorgar|"
    r"realizar|efectuar|preparar|archivar|enviar|recibir|custodiar|elaborar|implementar|difundir|"
    r"garantizar|procurar|velar|fiscalizar|designar|nombrar|convocar|decretar|disponer|resolver|"
    r"conocer|devenir)\b",
    re.I,
)
TRUNCADA_END = re.compile(
    r"(\s(y|o|u|e|de|del|la|el|los|las|un|una|su|sus|para|por|con|en|a|que|se|al|lo)\.?)$",
    re.I,
)


def sanear_titulo(s: str) -> str:
    s = re.sub(r"\s+", " ", s or "").strip().rstrip(".,;:-")
    while TRUNCADA_END.search(s) and len(s.split()) > 3:
        s = TRUNCADA_END.sub("", s).strip().rstrip(".,;:-")
    if INFINITIVO_START.match(s):
        s = "Regulación sobre " + s[0].lower() + s[1:]
    return s


def limpiar_texto_bcn(raw: str) -> str:
    if not raw:
        return ""
    lineas = []
    for ln in raw.replace("\r", "").split("\n"):
        t = ln.strip()
        if not t:
            continue
        if len(t) <= 28 and re.match(r"^(?:L\.|D\.?L\.|D\.F\.L\.|D\.O\.|Ley\s|Art\.(?:\s|\d)*$)", t, re.I):
            continue
        lineas.append(t)
    return re.sub(r"\s{2,}", " ", " ".join(lineas)).strip()


def extraer_num_art(nombre_parte: str, texto: str) -> str:
    if nombre_parte and nombre_parte.strip():
        return nombre_parte.strip()
    m = re.match(
        r"^(?:ART[IÍ]CULO|Art[ií]culo)\s+([0-9]{1,4}(?:\s*[°º])?(?:\s*(?:bis|ter|qu[aá]ter|quinquies|[A-Z]))?)",
        texto,
    )
    if m:
        return re.sub(r"\s+", " ", m.group(1)).replace("°", "").replace("º", "").strip()
    return ""


def descargar_xml(id_norma: int) -> str:
    url = f"https://www.leychile.cl/Consulta/obtxml?opt=7&idNorma={id_norma}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "legalhelp.cl/1.0 (ingesta corpus transito; contacto soporte@legalhelp.cl)"},
    )
    return urllib.request.urlopen(req, timeout=30).read().decode("utf-8", errors="replace")


def extraer_fichas_bcn() -> list[dict]:
    fichas = []
    for num_ley, id_norma, nombre_ley in LEYES_BCN:
        xml_str = descargar_xml(id_norma)
        fv_m = re.search(r'fechaVersion="([0-9-]{8,10})"', xml_str[:4000])
        fv = fv_m.group(1) if fv_m else ""
        root = ET.fromstring(xml_str)

        def recorrer(contenedor, contexto_titulo: str):
            for ef in contenedor.findall("{*}EstructuraFuncional"):
                tp = ef.attrib.get("tipoParte", "")
                idp = ef.attrib.get("idParte", "")
                meta_el = ef.find("{*}Metadatos")
                np_el = meta_el.find("{*}NombreParte") if meta_el is not None else ef.find("{*}NombreParte")
                ti_el = meta_el.find("{*}TituloParte") if meta_el is not None else ef.find("{*}TituloParte")
                tx_el = ef.find("{*}Texto")
                np_txt = (np_el.text if np_el is not None and np_el.text else "").strip()
                ti_txt = limpiar_texto_bcn(ti_el.text if ti_el is not None and ti_el.text else "")
                tx_txt = limpiar_texto_bcn(tx_el.text if tx_el is not None and tx_el.text else "")

                sub = ef.find("{*}EstructurasFuncionales")
                if tp != "Artículo":
                    encabezado = ti_txt or tx_txt
                    nuevo_ctx = encabezado if encabezado else contexto_titulo
                    if sub is not None:
                        recorrer(sub, nuevo_ctx)
                    continue

                if not tx_txt or len(tx_txt) < 45:
                    continue
                sin_cab = re.sub(r"^ART[IÍ]CULO\s+[^\s.-]+[.-]*\s*", "", tx_txt, flags=re.I).strip()
                if re.match(r"^(?:DEROGADO|SUPRIMIDO)\.?$", sin_cab, re.I):
                    continue

                num_art = extraer_num_art(np_txt, tx_txt)
                if not num_art:
                    continue

                ctx_limpio = re.sub(r"^T[IÍ]TULO\s+[IVXLCDM0-9]+\s*", "", contexto_titulo, flags=re.I).strip()
                if not ctx_limpio:
                    ctx_limpio = nombre_ley
                resumen_corto = sin_cab[:110].split(".")[0].strip()
                inst_raw = f"Ley {num_ley} Art. {num_art} — {ctx_limpio}"
                if len(inst_raw) > 135:
                    inst_raw = inst_raw[:132].rsplit(" ", 1)[0]
                institucion = sanear_titulo(inst_raw)
                definicion = tx_txt[:420].strip()
                url_bcn = f"https://www.bcn.cl/leychile/navegar?idNorma={id_norma}" + (f"&idParte={idp}" if idp else "")
                operativa = f"Texto normativo oficial vigente (versión {fv or 'BCN'}, {url_bcn}). {resumen_corto}."
                contenido = f"**{nombre_ley} — Artículo {num_art} ({ctx_limpio}):**\n{tx_txt[:2300]}"
                tokens = len(re.findall(r"[a-zA-ZáéíóúñÁÉÍÓÚÑ0-9]{3,}", f"{institucion} {ctx_limpio} {tx_txt}"))

                fichas.append({
                    "id": f"bcn_{id_norma}_art_{re.sub(r'[^a-zA-Z0-9]+', '_', num_art).strip('_').lower()}",
                    "institucion": institucion,
                    "area": "Tránsito y Policía Local",
                    "materia": f"{nombre_ley} — {ctx_limpio}",
                    "obra": f"{nombre_ley} (idNorma {id_norma}, XML oficial BCN)",
                    "autor": "Biblioteca del Congreso Nacional de Chile (BCN)",
                    "definicion": definicion,
                    "conFalloRector": False,
                    "operativaProcesal": operativa[:400],
                    "fallos": [],
                    "falloRector": None,
                    "normas": [f"BCN - Ley N° {num_ley}, Art. {num_art}"],
                    "tokens": tokens,
                    "contenido": contenido,
                })

        estructuras = root.find("{*}EstructurasFuncionales")
        if estructuras is not None:
            recorrer(estructuras, nombre_ley)
        else:
            recorrer(root, nombre_ley)
    return fichas


def extraer_fichas_doctrina_local() -> list[dict]:
    fichas = []
    civil_path = os.path.join(BASE_DIR, "data", "corpus-full", "civil.json")
    if os.path.isfile(civil_path):
        civil_data = json.load(open(civil_path, encoding="utf-8"))
        for f in civil_data.get("fichas", []):
            normas_str = " ".join(f.get("normas") or [])
            if "18.290" in normas_str or "18.287" in normas_str:
                copia = dict(f)
                copia["id"] = f"tr_{copia.get('id', 'civil')}"
                fichas.append(copia)

    try:
        import importlib.util
        spec = importlib.util.find_spec("pjud_connector")
        sp_data = os.path.join(os.path.dirname(spec.origin), "data") if spec and spec.origin else ""
    except Exception:
        sp_data = ""

    if sp_data and os.path.isdir(sp_data):
        re_tr = re.compile(
            r"\b(18\.?290|18\.?287|15\.?231|polic[ií]a\s+local|ley\s+de\s+tr[aá]nsito|"
            r"infracci[oó]n(?:es)?\s+de\s+tr[aá]nsito|accidente(?:s)?\s+de\s+tr[aá]nsito|"
            r"alcoholemia|delito\s+de\s+fuga|ebriedad)\b",
            re.I,
        )
        revistas = [
            ("rchd/catalogo_articulos.jsonl", "Revista Chilena de Derecho (PUC)"),
            ("rchdp/catalogo_articulos.jsonl", "Revista Chilena de Derecho Privado (UDP)"),
            ("rdpucv/catalogo_scielo.jsonl", "Revista de Derecho PUCV"),
            ("rduach/catalogo_articulos.jsonl", "Revista de Derecho UACh"),
            ("rducn/catalogo_articulos.jsonl", "Revista de Derecho UCN"),
        ]
        vistos_tit = set()
        idx_rev = 0
        for rel_path, nombre_revista in revistas:
            full_p = os.path.join(sp_data, rel_path)
            if not os.path.isfile(full_p):
                continue
            with open(full_p, encoding="utf-8") as fh:
                for line in fh:
                    if not re_tr.search(line):
                        continue
                    d = json.loads(line)
                    tit = sanear_titulo(str(d.get("title") or d.get("titulo") or ""))
                    resumen = str(d.get("abstract") or d.get("resumen") or "").strip()
                    if len(tit) < 15 or len(resumen) < 100:
                        continue
                    clave = tit.lower()
                    if clave in vistos_tit:
                        continue
                    vistos_tit.add(clave)
                    idx_rev += 1
                    autores = d.get("authors") or d.get("autores") or []
                    if isinstance(autores, list):
                        autor_str = ", ".join(str(a) for a in autores if a) or nombre_revista
                    else:
                        autor_str = str(autores) or nombre_revista
                    subjects = d.get("subjects") or []
                    mat_str = ", ".join(str(s) for s in subjects[:4] if s) if isinstance(subjects, list) else "Tránsito y Policía Local"
                    normas_det = []
                    for m_art in re.finditer(r"art[ií]culo\s+(\d{1,3}(?:\s*bis|\s*ter)?)\s+de\s+la\s+ley\s+de\s+tr[aá]nsito", f"{tit} {resumen}", re.I):
                        normas_det.append(f"BCN - Ley N° 18.290, Art. {m_art.group(1).strip()}")
                    if not normas_det:
                        normas_det = ["BCN - Ley N° 18.290", "BCN - Ley N° 18.287"]
                    fichas.append({
                        "id": f"doctrina_tr_{idx_rev:03d}",
                        "institucion": tit[:140],
                        "area": "Tránsito y Policía Local",
                        "materia": mat_str or "Derecho de Tránsito y Juzgados de Policía Local",
                        "obra": nombre_revista,
                        "autor": autor_str[:120],
                        "definicion": resumen[:420],
                        "conFalloRector": False,
                        "operativaProcesal": resumen[:380],
                        "fallos": [],
                        "falloRector": None,
                        "normas": normas_det,
                        "tokens": len(re.findall(r"[a-zA-ZáéíóúñÁÉÍÓÚÑ0-9]{3,}", f"{tit} {resumen}")),
                        "contenido": f"**Doctrina ({nombre_revista} — {autor_str}):**\n{resumen[:2300]}",
                    })
    return fichas


def main() -> None:
    fichas_bcn = extraer_fichas_bcn()
    fichas_doc = extraer_fichas_doctrina_local()
    todas = fichas_doc + fichas_bcn
    out = {
        "fuente": (
            "Ley Chile BCN XML oficial (Ley 18.290 idNorma=29708, Ley 18.287 idNorma=29705, "
            "Ley 15.231 idNorma=28104, Ley 18.490 idNorma=29893) + Doctrina chilena arbitrada "
            "(RChD, RChDP, RDPUCV, RDUACh, RDUCN) + Open Legal Chile"
        ),
        "total": len(todas),
        "fichas": todas,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)
    print(f"OK data/corpus-full/transito.json escrito: total={len(todas)} (doctrina={len(fichas_doc)}, bcn={len(fichas_bcn)})")


if __name__ == "__main__":
    main()
