#!/usr/bin/env python3
"""One-off: sube a vehicle-docs los archivos que faltan en Storage pero están
registrados en vehicle_documents. Recorre el ZIP extraído, casa por slugify
del basename, y hace `supabase storage cp --experimental`.

Uso:
    python .jez/zip_docs/backfill_docs.py
"""
from __future__ import annotations
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ZIP_ROOT = Path(".jez/zip_docs/COCHES STOCK")
DOCS_JSON = Path(".jez/zip_docs/docs_to_backfill_rest.json")
BUCKET = "vehicle-docs"


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9._-]+", "_", s)
    return s.strip("_")[:80]


def find_plate_folder(plate: str) -> Path | None:
    """Busca la carpeta del coche por matrícula dentro de ZIP_ROOT."""
    if plate == "DACIA_DOKKER":
        matches = [p for p in ZIP_ROOT.iterdir() if p.is_dir() and "DACIA DOKKER" in p.name.upper()]
    else:
        needle = plate.upper()
        matches = [p for p in ZIP_ROOT.iterdir()
                   if p.is_dir() and needle in re.sub(r"\s+", "", p.name.upper())]
    return matches[0] if matches else None


def find_file_in_folder(folder: Path, expected_basename: str) -> Path | None:
    """Busca recursivamente un archivo cuyo slugify(name) == slugify(expected_basename)."""
    target = slugify(expected_basename)
    for p in folder.rglob("*"):
        if p.is_file() and slugify(p.name) == target:
            return p
    return None


def upload(local: Path, remote: str) -> bool:
    cmd = ["supabase", "storage", "cp", "--experimental", "--yes",
           str(local), f"ss:///{BUCKET}/{remote}"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"  FAIL: {r.stderr[:300]}", file=sys.stderr)
        return False
    return True


def main():
    docs = json.loads(DOCS_JSON.read_text(encoding="utf-8"))
    print(f"Procesando {len(docs)} documentos...")
    ok = skipped_missing_folder = skipped_missing_file = failed = 0
    missing = []
    for doc in docs:
        plate = doc["plate"]
        file_name = doc["file_name"]
        storage_path = doc["storage_path"]
        folder = find_plate_folder(plate)
        if not folder:
            skipped_missing_folder += 1
            missing.append((doc["id"], plate, "carpeta no encontrada"))
            continue
        local = find_file_in_folder(folder, file_name)
        if not local:
            skipped_missing_file += 1
            missing.append((doc["id"], plate, f"archivo '{file_name}' no encontrado en '{folder.name}'"))
            continue
        if upload(local, storage_path):
            ok += 1
            print(f"  OK [{plate}] {storage_path}")
        else:
            failed += 1
    print()
    print("=" * 60)
    print(f"Subidos OK:           {ok}")
    print(f"Fallos de upload:     {failed}")
    print(f"Carpeta no encontrada: {skipped_missing_folder}")
    print(f"Archivo no encontrado: {skipped_missing_file}")
    if missing:
        print("\nFaltantes:")
        for mid, plate, reason in missing:
            print(f"  id={mid} [{plate}] {reason}")


if __name__ == "__main__":
    main()
