#!/usr/bin/env python3
"""
Análisis del zip de stock de CodinaCars (Fase A).

Lee la carpeta extraída del zip que pasó Ricard, identifica cada coche,
clasifica los archivos y genera un JSON con el plan de importación.

Uso:
    python scripts/analyze_zip_stock.py <ruta_carpeta_extraída> [--out plan.json]

Salida:
    plan.json con la estructura:
    {
      "cars": [
        {
          "folder": "1ºt , SEAT IBIZA 0229LVS",
          "plate": "0229LVS",
          "guess_model": "SEAT IBIZA",
          "is_sold": true,
          "files": {
            "factura_compra": ["FRA COMPRA.pdf"],
            "factura_comision": [],
            "ficha_tecnica": ["Ficha_Tecnica  0229LVS.pdf"],
            "permiso_circulacion": ["permiso.pdf"],
            "contrato_venta": ["contrato cv + mandato.pdf"],
            "dni_cliente": ["DNI COMPRADOR , COMPLETO.pdf"],
            "reparacion": [],
            "mantenimiento": [],
            "otros": ["CLÁUSULA DE SUSTITUCIÓN Y COMPENSACIÓN.docx"],
            "fotos_principales": [...],
            "fotos_secundarias": [...]
          },
          "skip_reason": null
        },
        ...
      ],
      "stats": {...}
    }

No toca BD ni Storage. Solo analiza y genera el plan.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Optional

# Patrón de matrícula española actual: 4 dígitos + 3 letras (sin vocales).
PLATE_NEW = re.compile(r"\b(\d{4})\s*([A-Z]{3})\b")
# Patrón antiguo (provincia + números + letras): B 6246 JW, etc.
PLATE_OLD = re.compile(r"\b([A-Z]{1,2})\s*[-]?\s*(\d{4})\s*([A-Z]{1,2})\b")

# Categorías de archivos por patrones en el nombre.
FILE_CATEGORIES: list[tuple[str, list[str]]] = [
    ("factura_comision", ["comis"]),
    ("factura_compra", ["factura compra", "fra compra", "factura-", "factura "]),
    ("ficha_tecnica", ["ficha tecnica", "ficha_tecnica", "ficha técnica", "ficha."]),
    ("permiso_circulacion", ["permiso", "permis"]),
    ("contrato_venta", ["contrato", "mandato", "compraventa"]),
    ("dni_cliente", ["dni"]),
    ("reparacion", ["reparacio", "reparación", "reparacion"]),
    ("mantenimiento", ["mantenimient", "manteniment"]),
    ("financiacion", ["financiacion", "financiación"]),
]

# Subcarpetas que indican fotos definitivas (validado Ricard 2026-04-08).
DEFINITIVE_FOLDERS = [
    "fotos definitivas", "fotos finales", "fotos nuevas",
    "fotos definitivas . ok", "fotos finales . ok", "fotos finales ok",
    "fotos finales. ok", "fotos finales .ok", "fotos finales.ok",
    "definitivas", "finales", "nuevas",
]

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"}


def normalize(s: str) -> str:
    return s.lower().strip()


def extract_plate(name: str) -> Optional[str]:
    """Extrae matrícula española del nombre. Prefiere formato nuevo."""
    # Quitar letras minúsculas para evitar falsos positivos como "ok".
    upper = name.upper()
    m = PLATE_NEW.search(upper)
    if m:
        return f"{m.group(1)}{m.group(2)}"
    m = PLATE_OLD.search(upper)
    if m:
        return f"{m.group(1)}{m.group(2)}{m.group(3)}"
    return None


def guess_model(folder: str, plate: Optional[str]) -> str:
    """Limpia el nombre de carpeta para sacar marca+modelo aproximado."""
    s = folder
    # Quitar prefijos tipo "1ºT 26.", "3º T .", etc.
    s = re.sub(r"^\s*\d+\s*[ºo]?\s*[tT]\s*[.,]?\s*", "", s)
    s = re.sub(r"^\s*\d+\s*[.,]?\s*", "", s)
    # Quitar matrícula
    if plate:
        s = re.sub(re.escape(plate), "", s, flags=re.IGNORECASE)
        # También por si tiene espacios entre dígitos y letras
        if len(plate) >= 7:
            spaced = f"{plate[:4]}\\s*{plate[4:]}"
            s = re.sub(spaced, "", s, flags=re.IGNORECASE)
    # Quitar paréntesis y palabras de ruido
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"\b(OK|ok|frenos|bombin)\b", "", s)
    # Limpiar puntuación y espacios sobrantes
    s = re.sub(r"[.,]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def classify_file(filename: str) -> str:
    n = normalize(filename)
    for cat, patterns in FILE_CATEGORIES:
        for p in patterns:
            if p in n:
                return cat
    return "otros"


def is_image(name: str) -> bool:
    return Path(name).suffix.lower() in IMAGE_EXTS


def is_definitive_folder(folder_name: str) -> bool:
    n = normalize(folder_name)
    return any(d in n for d in DEFINITIVE_FOLDERS)


def analyze_car_folder(folder: Path, base: Path) -> dict:
    rel = folder.relative_to(base).as_posix()
    plate = extract_plate(folder.name)
    model = guess_model(folder.name, plate)

    files: dict[str, list[str]] = {
        "factura_compra": [],
        "factura_comision": [],
        "ficha_tecnica": [],
        "permiso_circulacion": [],
        "contrato_venta": [],
        "dni_cliente": [],
        "reparacion": [],
        "mantenimiento": [],
        "financiacion": [],
        "otros": [],
        "fotos_principales": [],
        "fotos_secundarias": [],
    }

    for entry in folder.rglob("*"):
        if entry.is_dir():
            continue
        rel_path = entry.relative_to(base).as_posix()
        name = entry.name
        if is_image(name):
            # Ver en qué subcarpeta está
            parents = [p.name for p in entry.relative_to(folder).parents]
            in_subfolder = len(parents) > 1
            if in_subfolder:
                # Hay subcarpeta — comprobar si es definitiva
                subfolder = entry.parent.name
                if is_definitive_folder(subfolder):
                    files["fotos_principales"].append(rel_path)
                else:
                    files["fotos_secundarias"].append(rel_path)
            else:
                # Foto en raíz de la carpeta del coche → principal
                files["fotos_principales"].append(rel_path)
        else:
            cat = classify_file(name)
            files[cat].append(rel_path)

    is_sold = bool(files["dni_cliente"]) or bool(files["contrato_venta"]) or bool(files["financiacion"])

    # ¿Carpeta vacía o casi vacía? — todos los buckets vacíos = ignorar
    has_any_doc = any(files[k] for k in ["factura_compra", "ficha_tecnica", "permiso_circulacion"])
    has_photos = len(files["fotos_principales"]) + len(files["fotos_secundarias"]) > 0
    skip_reason = None
    if not has_any_doc and not has_photos:
        skip_reason = "vacía"
    elif "z.bmw e30" in normalize(folder.name):
        skip_reason = "no es coche real (referencia/tabla)"
    elif "mazda 2" in normalize(folder.name) and not has_any_doc and not has_photos:
        skip_reason = "vacía"

    return {
        "folder": rel,
        "plate": plate,
        "guess_model": model,
        "is_sold": is_sold,
        "files": files,
        "skip_reason": skip_reason,
        "n_photos_main": len(files["fotos_principales"]),
        "n_photos_other": len(files["fotos_secundarias"]),
    }


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    base = Path(sys.argv[1])
    if not base.is_dir():
        print(f"No es un directorio: {base}", file=sys.stderr)
        sys.exit(1)

    out = "plan.json"
    if "--out" in sys.argv:
        out = sys.argv[sys.argv.index("--out") + 1]

    # Buscar la carpeta raíz "COCHES STOCK" automáticamente
    if (base / "COCHES STOCK").is_dir():
        base = base / "COCHES STOCK"

    cars: list[dict] = []
    for entry in sorted(base.iterdir()):
        if not entry.is_dir():
            continue
        cars.append(analyze_car_folder(entry, base))

    # Stats
    n_total = len(cars)
    n_skip = sum(1 for c in cars if c["skip_reason"])
    n_sold = sum(1 for c in cars if c["is_sold"] and not c["skip_reason"])
    n_with_plate = sum(1 for c in cars if c["plate"] and not c["skip_reason"])
    n_photos = sum(c["n_photos_main"] + c["n_photos_other"] for c in cars if not c["skip_reason"])
    n_pdfs = sum(
        sum(len(v) for k, v in c["files"].items() if k not in ("fotos_principales", "fotos_secundarias"))
        for c in cars
    )

    plan = {
        "base_dir": str(base),
        "stats": {
            "total_carpetas": n_total,
            "ignoradas": n_skip,
            "a_importar": n_total - n_skip,
            "vendidos_detectados": n_sold,
            "con_matricula": n_with_plate,
            "fotos_total": n_photos,
        },
        "cars": cars,
    }

    Path(out).write_text(json.dumps(plan, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Plan generado: {out}")
    print(f"Resumen: {plan['stats']}")
    # Imprimir resumen por coche
    print("\n--- RESUMEN POR COCHE ---")
    for c in cars:
        marker = "SKIP" if c["skip_reason"] else ("VEND" if c["is_sold"] else "DISP")
        plate = c["plate"] or "??"
        n_main = c["n_photos_main"]
        n_other = c["n_photos_other"]
        n_docs = sum(len(v) for k, v in c["files"].items() if k not in ("fotos_principales", "fotos_secundarias"))
        print(f"  [{marker}] {plate:>10}  {n_main:>3} fotos+{n_other:>3} sec  {n_docs} docs  {c['guess_model'][:50]}")
        if c["skip_reason"]:
            print(f"       skip: {c['skip_reason']}")


if __name__ == "__main__":
    main()
