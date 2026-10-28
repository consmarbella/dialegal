"""Fase 6 - Actualizacion automatica del corpus chileno por hash del dataset HF.

Orquestra: descarga del snapshot HF -> comparacion por sha256 contra
.corpus-version -> si cambio, re-ingesta FULL -> guardia de tamano -> QA 13/13
-> guarda nueva version. Si la QA falla o el tamano excede el limite, sale con
exit 1 (el workflow de GitHub Actions aborta Y NO commitea/pushea).

Diseño acordado en Fase 6 (DECISIONES.md):
  - Verificacion por hash: sin cambios = sin rebuild/deploy inutil.
  - Candado de QA: fichas que rompan la integracion nunca llegan a prod.
  - Limite de guardia: el lambda serverless no se hincha sin alerta.

Uso:  python scripts/corpus_update.py [--forzar]
Opciones: --forzar reingesta aunque el hash coincida (util tras cambiar el
generador, ej. pasar de modo base a full).
"""

import hashlib
import json
import os
import shutil
import subprocess
import sys
from datetime import date

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
CORPUS_DIR = os.path.join(ROOT, "data", "corpus-full")
VER_FILE = os.path.join(ROOT, ".corpus-version")
MAX_CORPUS_MB = int(os.environ.get("CORPUS_MAX_MB", "100"))  # guardia de size

REPO_ID = "pablobenavidesj/doctrina-jurisprudencia-chile-training"
DATASET_FILE = "data/instituciones.jsonl"

SLUGS = ["laboral", "civil", "familia", "penal", "administrativo", "constitucional", "transversal"]


def descargar_dataset() -> str:
    """Baja el snapshot vigente del dataset (cache de huggingface_hub) y
    devuelve la ruta local del JSONL."""
    from huggingface_hub import hf_hub_download
    return hf_hub_download(repo_id=REPO_ID, repo_type="dataset", filename=DATASET_FILE)


def sha256_archivo(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def leer_version() -> dict:
    if os.path.isfile(VER_FILE):
        try:
            with open(VER_FILE, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def totales_actuales() -> dict:
    total = {}
    for s in SLUGS:
        p = os.path.join(CORPUS_DIR, f"{s}.json")
        if os.path.isfile(p):
            try:
                with open(p, encoding="utf-8") as f:
                    total[s] = len(json.load(f).get("fichas", []))
            except Exception:
                total[s] = 0
    return total


def mb_corpus() -> float:
    total = 0
    data_dir = os.path.join(ROOT, "data")
    for nom in os.listdir(data_dir):
        p = os.path.join(data_dir, nom)
        if os.path.isfile(p) and nom.endswith(".json"):
            total += os.path.getsize(p)
        elif os.path.isdir(p) and nom == "corpus-full":
            for arch in os.listdir(p):
                total += os.path.getsize(os.path.join(p, arch))
    return total / (1024 * 1024)


def correr_qa() -> bool:
    npx = shutil.which("npx") or shutil.which("npx.cmd")
    if not npx:
        print("ERROR: npx no disponible; no puedo correr la QA de candado.")
        return False
    cmd = [npx, "tsx", "scripts/qa-corpus-fase5.ts"]
    r = subprocess.run(cmd, cwd=ROOT, shell=False, capture_output=True, text=True, encoding="utf-8", errors="replace")
    cola = (r.stdout or "")[-1200:]
    print(f"QA corpus (exit={r.returncode}):\n{cola}")
    return r.returncode == 0


def main() -> None:
    forzar = "--forzar" in sys.argv[1:]

    print("[1/5] Descargando dataset HF...")
    try:
        jsonl = descargar_dataset()
    except Exception as e:
        print(f"ERROR descargando {REPO_ID}: {e}")
        sys.exit(1)

    sha = sha256_archivo(jsonl)
    prev = leer_version()
    if not forzar and prev.get("dataset_sha256") == sha:
        print(f"Sin cambios respecto a la versión ingesta ({prev.get('actualizado')}); no se regenera ni se commitea.")
        sys.exit(0)

    antes = totales_actuales()
    print(f"[2/5] Dataset cambió (hash {prev.get('dataset_sha256', 'primera-vez')[:12]} -> {sha[:12]}). Regenerando corpus-full (FULL)...")
    r = subprocess.run([sys.executable, os.path.join(BASE, "corpus_ingest_full.py"), jsonl],
                       cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
    print((r.stdout or "")[-1500:])
    if r.returncode != 0:
        print(f"ERROR ingesta (exit {r.returncode}): {(r.stderr or '')[-500:]}")
        sys.exit(1)

    despues = totales_actuales()
    delta = {s: despues.get(s, 0) - antes.get(s, 0) for s in SLUGS if despues.get(s, 0) != antes.get(s, 0)}

    mb = mb_corpus()
    print(f"[3/5] Guardia de tamaño: {mb:.1f} MB (límite {MAX_CORPUS_MB} MB)")
    if mb > MAX_CORPUS_MB:
        print(f"ERROR: corpus ({mb:.1f} MB) supera el límite {MAX_CORPUS_MB} MB. Aborta sin commit.")
        sys.exit(1)

    print("[4/5] Candado de QA (13/13 determinista)...")
    if not correr_qa():
        print("ERROR: QA FALLA. El workflow aborta y NO hace commit/push.")
        sys.exit(1)

    os.makedirs(os.path.dirname(VER_FILE), exist_ok=True)
    with open(VER_FILE, "w", encoding="utf-8") as f:
        json.dump({
            "dataset_sha256": sha,
            "actualizado": date.today().isoformat(),
            "fichas": despues,
        }, f, ensure_ascii=False)

    print(f"[5/5] OK. Totales: {despues}")
    print(f"Delta vs version previa: {delta if delta else 'sin delta de conteos (dedup pleno)'}")
    resumen = " ; ".join(f"{s}{d:+d}" for s, d in delta.items()) or "sin-delta"
    print(f"RESUMEN-CORPUS: totales={sum(despues.values())} delta={resumen} mb={mb:.1f}")


if __name__ == "__main__":
    main()
