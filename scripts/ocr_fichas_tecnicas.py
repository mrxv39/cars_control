#!/usr/bin/env python3
"""
Extrae datos de las fichas técnicas (PDF) ya subidas a Supabase Storage.

Validado Ricard 2026-04-08. Caso de uso: para los vehículos importados
del zip que NO tienen matrícula en el nombre de carpeta, sacarla del PDF
de la ficha técnica.

Estrategia:
  1. Descarga cada vehicle_documents.doc_type='ficha_tecnica' del bucket.
  2. Intenta extracción de texto con pdfplumber (PDFs basados en texto).
  3. Si no hay texto, marca como "necesita OCR cloud" — no hacemos OCR
     local porque requiere Tesseract instalado y conversión PDF→imagen.
  4. Regex para matrícula (####ABC), VIN (17 chars), año (1990-2026).
  5. Genera un JSON con los hallazgos.
  6. Si --apply, actualiza vehicles.plate / vehicles.vin en BD.

Uso:
    python scripts/ocr_fichas_tecnicas.py [--apply]
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: pip install requests", file=sys.stderr)
    sys.exit(1)

try:
    import pdfplumber
except ImportError:
    print("ERROR: pip install pdfplumber", file=sys.stderr)
    sys.exit(1)

PROJECT_REF = "hyydkyhvgcekvtkrnspf"
SUPABASE_URL = f"https://{PROJECT_REF}.supabase.co"
BUCKET_DOCS = "vehicle-docs"

# Anon key (pública, misma que en el frontend). RLS abierta en vehicle-docs.
ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5eWRreWh2Z2Nla3Z0a3Juc3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MDU3MDQsImV4cCI6MjA4OTQ4MTcwNH0."
    "54OcvlXRN9Bb7yhxUw2ufhWT2GypqCu3wH26fJuCuRA"
)

PLATE_RE = re.compile(r"\b(\d{4})\s*([B-DF-HJ-NP-TV-Z]{3})\b")
PLATE_OLD_RE = re.compile(r"\b([A-Z]{1,2})\s*[-]?\s*(\d{4})\s*[-]?\s*([A-Z]{1,2})\b")
VIN_RE = re.compile(r"\b([A-HJ-NPR-Z0-9]{17})\b")
YEAR_RE = re.compile(r"\b(19[89]\d|20[0-2]\d)\b")

# Patrones típicos en fichas técnicas españolas
BRAND_LABELS = ["MARCA", "FABRICANTE", "MAKE"]
MODEL_LABELS = ["DENOMINACION COMERCIAL", "MODELO", "MODEL"]


def supabase_request(path: str, method: str = "GET", **kwargs) -> requests.Response:
    headers = kwargs.pop("headers", {}) or {}
    headers["apikey"] = ANON_KEY
    headers["Authorization"] = f"Bearer {ANON_KEY}"
    return requests.request(method, f"{SUPABASE_URL}{path}", headers=headers, **kwargs)


def list_ficha_docs() -> list[dict]:
    """Lista todas las fichas técnicas en BD via PostgREST."""
    r = supabase_request(
        "/rest/v1/vehicle_documents?doc_type=eq.ficha_tecnica&select=id,vehicle_id,file_name,storage_path"
    )
    r.raise_for_status()
    return r.json()


def get_vehicle(vehicle_id: int) -> dict | None:
    r = supabase_request(
        f"/rest/v1/vehicles?id=eq.{vehicle_id}&select=id,name,plate,vin,anio"
    )
    r.raise_for_status()
    rows = r.json()
    return rows[0] if rows else None


def download_doc(storage_path: str) -> bytes | None:
    url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET_DOCS}/{storage_path}"
    r = requests.get(url, timeout=30)
    if r.status_code != 200:
        print(f"  download FAIL [{r.status_code}] {storage_path}", file=sys.stderr)
        return None
    return r.content


def extract_pdf_text(pdf_bytes: bytes) -> str:
    """Extrae texto plano de un PDF. Devuelve cadena vacía si no hay capa de texto."""
    import io
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            parts = []
            for page in pdf.pages:
                t = page.extract_text() or ""
                parts.append(t)
            return "\n".join(parts)
    except Exception as e:
        print(f"  pdfplumber error: {e}", file=sys.stderr)
        return ""


def parse_text(text: str) -> dict:
    """Busca matrícula, VIN, año en el texto extraído."""
    out: dict = {"plate": None, "vin": None, "year": None}
    if not text:
        return out
    upper = text.upper()
    # Matrícula nueva
    m = PLATE_RE.search(upper)
    if m:
        out["plate"] = f"{m.group(1)}{m.group(2)}"
    else:
        m2 = PLATE_OLD_RE.search(upper)
        if m2:
            out["plate"] = f"{m2.group(1)}{m2.group(2)}{m2.group(3)}"
    # VIN: descartar candidatos que sean otros números (precio, etc.)
    for vm in VIN_RE.finditer(upper):
        cand = vm.group(1)
        # Un VIN real tiene mezcla de letras y dígitos
        if any(c.isalpha() for c in cand) and any(c.isdigit() for c in cand):
            out["vin"] = cand
            break
    # Año
    ym = YEAR_RE.search(upper)
    if ym:
        out["year"] = int(ym.group(1))
    return out


def main():
    apply_changes = "--apply" in sys.argv
    print(f"Modo: {'APPLY (actualizará BD)' if apply_changes else 'DRY RUN'}")
    print()

    docs = list_ficha_docs()
    print(f"Fichas técnicas encontradas: {len(docs)}\n")

    results = []
    for i, doc in enumerate(docs, 1):
        vehicle = get_vehicle(doc["vehicle_id"])
        if not vehicle:
            continue
        marker = f"[{i}/{len(docs)}] vehicle_id={vehicle['id']}  {vehicle['name'][:40]}"
        print(marker)
        print(f"     PDF: {doc['file_name']}")

        pdf_bytes = download_doc(doc["storage_path"])
        if not pdf_bytes:
            results.append({"vehicle_id": vehicle["id"], "status": "download_fail"})
            continue

        text = extract_pdf_text(pdf_bytes)
        if not text.strip():
            print("     -> sin capa de texto (escaneo). NEEDS OCR CLOUD")
            results.append({
                "vehicle_id": vehicle["id"],
                "name": vehicle["name"],
                "current_plate": vehicle.get("plate"),
                "status": "needs_ocr_cloud",
            })
            continue

        parsed = parse_text(text)
        print(f"     -> plate={parsed['plate']}  vin={parsed['vin']}  year={parsed['year']}")
        results.append({
            "vehicle_id": vehicle["id"],
            "name": vehicle["name"],
            "current_plate": vehicle.get("plate"),
            "extracted": parsed,
            "status": "ok",
        })

        if apply_changes:
            updates = {}
            if parsed["plate"] and not vehicle.get("plate"):
                updates["plate"] = parsed["plate"]
            if parsed["vin"] and not vehicle.get("vin"):
                updates["vin"] = parsed["vin"]
            if parsed["year"] and not vehicle.get("anio"):
                updates["anio"] = parsed["year"]
            if updates:
                r = supabase_request(
                    f"/rest/v1/vehicles?id=eq.{vehicle['id']}",
                    method="PATCH",
                    headers={"Content-Type": "application/json", "Prefer": "return=minimal"},
                    data=json.dumps(updates),
                )
                if r.status_code in (200, 204):
                    print(f"     -> BD actualizada: {updates}")
                else:
                    print(f"     -> ERROR update {r.status_code}: {r.text[:200]}")

    out_path = Path("C:/Users/Usuario/Downloads/ocr_fichas_result.json")
    out_path.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    print()
    print(f"Resultado guardado en: {out_path}")
    summary = {
        "total": len(results),
        "ok": sum(1 for r in results if r.get("status") == "ok"),
        "with_plate": sum(1 for r in results if r.get("status") == "ok" and r.get("extracted", {}).get("plate")),
        "needs_ocr_cloud": sum(1 for r in results if r.get("status") == "needs_ocr_cloud"),
        "download_fail": sum(1 for r in results if r.get("status") == "download_fail"),
    }
    print(f"Resumen: {summary}")


if __name__ == "__main__":
    main()
