#!/usr/bin/env python3
"""
Importación del zip de stock CodinaCars (Fase B).

Estrategia en 2 pasos:
  1. Sube todos los archivos a Supabase Storage usando el CLI supabase
     (ya autenticado, no necesita credenciales adicionales).
  2. Genera un fichero SQL con todos los INSERTs (vehicles, vehicle_photos,
     vehicle_documents) listo para ejecutar.

Uso:
    python scripts/analyze_zip_stock.py <zip_dir> --out plan.json
    python scripts/import_zip_stock.py plan.json --out import.sql
    # Después ejecutar import.sql contra Supabase

Validado con Ricard 2026-04-08. Conservador: solo importa lo 100% claro.
NO crea purchase_records, clients, sales_records — eso lo hace Ricard manual.
"""
from __future__ import annotations

import json
import mimetypes
import os
import re
import sys
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: pip install requests", file=sys.stderr)
    sys.exit(1)

PROJECT_REF = "kpgkcersrfvzncqupkxa"
SUPABASE_URL = f"https://{PROJECT_REF}.supabase.co"
BUCKET_PHOTOS = "vehicle-photos"
BUCKET_DOCS = "vehicle-docs"

SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not SERVICE_KEY:
    raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY env var is required. Set it in .env")


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9._-]+", "_", s)
    return s.strip("_")[:80]


def storage_cp(local: Path, bucket: str, remote: str) -> bool:
    """Sube un archivo a Supabase Storage via REST API con la legacy service_role JWT."""
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{remote}"
    mime, _ = mimetypes.guess_type(local.name)
    if not mime:
        mime = "application/octet-stream"
    headers = {
        "Authorization": f"Bearer {SERVICE_KEY}",
        "apikey": SERVICE_KEY,
        "Content-Type": mime,
        "x-upsert": "true",
    }
    try:
        with open(local, "rb") as f:
            data = f.read()
        r = requests.post(url, headers=headers, data=data, timeout=120)
        if r.status_code in (200, 201):
            return True
        print(f"  FAIL [{r.status_code}] {bucket}/{remote}: {r.text[:200]}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"  EXC {bucket}/{remote}: {e}", file=sys.stderr)
        return False


def sql_str(s: str | None) -> str:
    if s is None:
        return "NULL"
    return "'" + s.replace("'", "''") + "'"


def sql_bool(b: bool) -> str:
    return "TRUE" if b else "FALSE"


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    plan_path = Path(sys.argv[1])
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    base_dir = Path(plan["base_dir"])

    out_sql = "import.sql"
    if "--out" in sys.argv:
        out_sql = sys.argv[sys.argv.index("--out") + 1]
    company_id = 1
    if "--company-id" in sys.argv:
        company_id = int(sys.argv[sys.argv.index("--company-id") + 1])

    cars = [c for c in plan["cars"] if not c["skip_reason"]]
    if "--limit" in sys.argv:
        n = int(sys.argv[sys.argv.index("--limit") + 1])
        cars = cars[:n]
    print(f"Plan: {len(cars)} coches | base_dir: {base_dir}")
    print()

    # Para cada coche reservamos un placeholder de id que se resolverá en el SQL
    # con un CTE WITH ... INSERT ... RETURNING id. Mucho más fácil:
    # generamos UUIDs locales por coche y luego en SQL los insertamos uno a uno.
    # Para no liarnos: insertamos cada coche con RETURNING id y guardamos en una
    # variable temporal. Hacemos un SQL multi-statement con DO blocks.

    sql_lines: list[str] = [
        "-- Importación zip stock CodinaCars (autogenerado)",
        "-- Validado con Ricard 2026-04-08",
        "BEGIN;",
        "",
    ]

    total_uploaded_photos = 0
    total_uploaded_docs = 0
    total_failed = 0

    for car_idx, car in enumerate(cars, 1):
        plate = car["plate"]
        name = car["guess_model"] or "Vehículo sin nombre"
        needs_review = (
            not plate
            or bool(car["files"]["dni_cliente"])
            or bool(car["files"]["contrato_venta"])
        )

        print(f"[{car_idx}/{len(cars)}] {plate or '????'}  {name}")

        # 1. Reservar variable SQL para el id del coche con DO block
        sql_lines.append(f"-- Coche {car_idx}: {name} ({plate or 'sin matrícula'})")
        sql_lines.append("DO $$")
        sql_lines.append("DECLARE v_id bigint;")
        sql_lines.append("BEGIN")
        notes = f"Importado del zip ({car['folder']})"
        sql_lines.append(
            f"INSERT INTO vehicles (company_id, name, plate, estado, needs_review, notes) "
            f"VALUES ({company_id}, {sql_str(name)}, {sql_str(plate)}, 'disponible', "
            f"{sql_bool(needs_review)}, {sql_str(notes)}) RETURNING id INTO v_id;"
        )

        # 2. Subir fotos en paralelo
        photo_uploads = []
        all_photos = (
            [(p, True) for p in car["files"]["fotos_principales"]]
            + [(p, False) for p in car["files"]["fotos_secundarias"]]
        )
        # Como no sabemos el id real, usamos el plate o el folder slug como prefijo
        prefix = slugify(plate or car["folder"])
        for rel_path, is_main in all_photos:
            local = base_dir / rel_path
            if not local.exists():
                continue
            remote_name = f"{prefix}/{slugify(local.name)}"
            photo_uploads.append((local, remote_name, local.name))

        uploaded_photos: list[tuple[str, str]] = []
        with ThreadPoolExecutor(max_workers=8) as ex:
            futures = {
                ex.submit(storage_cp, lp, BUCKET_PHOTOS, rn): (rn, fn)
                for lp, rn, fn in photo_uploads
            }
            for fut in as_completed(futures):
                rn, fn = futures[fut]
                if fut.result():
                    uploaded_photos.append((rn, fn))
        n_failed = len(photo_uploads) - len(uploaded_photos)
        total_failed += n_failed
        total_uploaded_photos += len(uploaded_photos)
        print(f"    fotos: {len(uploaded_photos)}/{len(photo_uploads)} subidas")

        for storage_path, file_name in uploaded_photos:
            sql_lines.append(
                f"INSERT INTO vehicle_photos (vehicle_id, file_name, storage_path) "
                f"VALUES (v_id, {sql_str(file_name)}, {sql_str(storage_path)});"
            )

        # 3. Documentos
        doc_uploads = []
        for doc_type, files in car["files"].items():
            if doc_type in ("fotos_principales", "fotos_secundarias"):
                continue
            for rel_path in files:
                local = base_dir / rel_path
                if not local.exists():
                    continue
                remote_name = f"{prefix}/{slugify(local.name)}"
                doc_uploads.append((local, remote_name, doc_type, local.name))

        uploaded_docs: list[tuple[str, str, str]] = []
        with ThreadPoolExecutor(max_workers=4) as ex:
            futures = {
                ex.submit(storage_cp, lp, BUCKET_DOCS, rn): (rn, dt, fn)
                for lp, rn, dt, fn in doc_uploads
            }
            for fut in as_completed(futures):
                rn, dt, fn = futures[fut]
                if fut.result():
                    uploaded_docs.append((rn, dt, fn))
        n_failed_d = len(doc_uploads) - len(uploaded_docs)
        total_failed += n_failed_d
        total_uploaded_docs += len(uploaded_docs)
        print(f"    docs: {len(uploaded_docs)}/{len(doc_uploads)} subidos")

        for storage_path, doc_type, file_name in uploaded_docs:
            sql_lines.append(
                f"INSERT INTO vehicle_documents (vehicle_id, file_name, storage_path, doc_type, notes) "
                f"VALUES (v_id, {sql_str(file_name)}, {sql_str(storage_path)}, {sql_str(doc_type)}, '');"
            )

        sql_lines.append("END $$;")
        sql_lines.append("")

    sql_lines.append("COMMIT;")
    Path(out_sql).write_text("\n".join(sql_lines), encoding="utf-8")
    print()
    print("=" * 60)
    print(f"SQL generado: {out_sql}")
    print(f"TOTAL fotos subidas: {total_uploaded_photos}")
    print(f"TOTAL docs subidos: {total_uploaded_docs}")
    print(f"TOTAL fallos: {total_failed}")


if __name__ == "__main__":
    main()
