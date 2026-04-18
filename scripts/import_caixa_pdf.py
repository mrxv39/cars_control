#!/usr/bin/env python3
"""
Importador de extractos CaixaBank Banca Premier en formato PDF.

Contexto
--------
CaixaBank Banca Premier (la interfaz de Ricard) NO permite descargar Norma 43
ni un Excel real de movimientos — el único formato que llega a Descargas son
PDFs con una tabla de movimientos, uno por página aprox.

Estos PDFs usan un subset de fuente (`URWClassicSans-Bold`) SIN un ToUnicode
CMap, por lo que `pdfplumber` y `pdfminer` devuelven cadenas vacías. `pypdf`
en cambio sí resuelve los glifos a texto (con alguna pérdida en acentos). Por
eso este parser usa exclusivamente `pypdf`.

Formato de un movimiento (3 líneas en orden cronológico inverso):

    DD-MM-YYYY CONCEPTO                 (línea 1: fecha + descripción corta)
    OFICINA / REFERENCIA                (línea 2: oficina y ref/detalle)
    IMPORTE SALDO [EUR]                 (línea 3: dos importes, EUR opcional)

El importe NO viene firmado en la línea — el propio PDF lo coloca en columna
"INGRÉS" o "CÀRREC" pero la extracción plana pierde esa info de columna. Este
parser determina el signo mediante el **delta de saldos**: para cada fila,
`amount = saldo_after - saldo_after_fila_previa_en_el_tiempo`.

Cuando Ricard envía un extracto completo, CaixaBank lo trocea en varios PDFs
(`cuenta_5385.1.pdf` … `cuenta_5385.6.pdf`) donde `.1` es el MÁS RECIENTE y
`.6` el MÁS ANTIGUO. Para que la detección de signo funcione con continuidad
usa `--dir`: el script los ordena y concatena en orden cronológico.

La única fila que NO puede firmarse por delta es la más antigua del conjunto
(no tiene referencia previa). Se marca `sign_source="unknown"` y el importe
se graba con signo positivo por defecto (suele ser un ingreso/apertura).
Revisar en UI después.

Idempotencia
------------
`external_id = sha1(account_id + date + amount_abs + saldo + concepto + meta)`
Re-importar el mismo PDF NO duplica filas (UNIQUE bank_account_id+external_id).

Uso
---
    # Un solo PDF (firma todas las filas menos la más antigua)
    python scripts/import_caixa_pdf.py --account-id 2 --file cuenta_5385.1.pdf

    # Carpeta con todos los chunks de una cuenta
    python scripts/import_caixa_pdf.py --account-id 2 \
        --dir tmp_caixa_eml --match "cuenta_5385*.pdf"

    # Dry run: parsea e imprime resumen sin tocar BD
    python scripts/import_caixa_pdf.py --account-id 2 --file X.pdf --dry-run

Variables de entorno (sólo si NO es dry-run):
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY    (NO la anon key)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any
from urllib import request as urlrequest
from urllib.error import HTTPError

try:
    from pypdf import PdfReader
except ImportError as e:  # pragma: no cover
    raise SystemExit(
        "Falta dependencia: pip install pypdf "
        "(requerido para leer los PDFs de CaixaBank)"
    ) from e


# ---------------------------------------------------------------------------
# Regex
# ---------------------------------------------------------------------------

# Línea 1 de un movimiento: "DD-MM-YYYY <concepto>" — el concepto es
# opcional porque en transferencias con data_valor distinta, CaixaBank
# imprime booking_date y value_date en líneas separadas sin concepto.
DATE_RE = re.compile(r"^(\d{2}-\d{2}-\d{4})(?:\s+(.+))?$")

# Línea 3 de un movimiento: dos importes en formato español, EUR opcional.
# Acepta saldos negativos (póliza de crédito).
AMOUNT_LINE_RE = re.compile(
    r"^\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})(?:\s+EUR)?\s*$"
)

# Líneas que aparecen en el PDF pero NO son movimientos (cabeceras, pies).
# Se detectan por prefijo — no por igualdad — porque la extracción pypdf
# sustituye algunos caracteres por U+FFFD.
IGNORE_PREFIX_LITERALS: tuple[str, ...] = (
    "DATA CONCEPTE",
    "Data Valor Oficina",
    "cenprasp",            # timestamp de extracción
    "CaixaBank, S.A.",
    "NOM I COGNOMS",
    "IDENTIFICADOR",
    "STORE MOLINS",
    "AV. DE VALENCIA",
    "MOLINS DE REI (Tel",
    "Extracte",
    "Dip",                 # "Dipòsit de diner"
    "El titular",
    "les 24 hores",
    "Pagament de rebuts",
    "transfer",
    "(1)", "(2)",
    "exemptes",
    "Av",                  # "Avís"
    "Compte",
    "Living Solutions",
)

# Prefijo "PÀG. N" con diferentes encodings de À
IGNORE_PAGE_RE = re.compile(r"^P.G\.\s*\d+", re.IGNORECASE)


# ---------------------------------------------------------------------------
# Modelo
# ---------------------------------------------------------------------------

@dataclass
class PdfTransaction:
    booking_date: date
    concepto: str          # descripción corta (línea 1 tras la fecha)
    meta: str              # oficina / referencia (línea 2, a veces vacía)
    amount_abs: Decimal    # importe sin signo tal como aparece en el PDF
    saldo_after: Decimal   # saldo tras la operación

    # Se rellenan en el segundo pase (firma por delta + enriquecimiento)
    amount: Decimal | None = None
    sign_source: str = ""        # "delta" | "unknown" | "mismatch:..."
    source_pdf: str = ""
    row_index_in_pdf: int = 0

    @property
    def description(self) -> str:
        parts = [self.concepto.strip()]
        if self.meta and self.meta.strip():
            parts.append(self.meta.strip())
        return " | ".join(parts)

    def external_id(self, bank_account_id: int) -> str:
        """
        SHA1 estable: mismo PDF → mismo id aunque el signo cambie entre corridas
        (por eso hasheamos amount_abs y no amount firmado).
        """
        h = hashlib.sha1()
        h.update(str(bank_account_id).encode())
        h.update(self.booking_date.isoformat().encode())
        h.update(str(self.amount_abs).encode())
        h.update(str(self.saldo_after).encode())
        h.update(self.concepto.encode("utf-8", errors="replace"))
        h.update(self.meta.encode("utf-8", errors="replace"))
        return h.hexdigest()


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

def parse_eur(s: str) -> Decimal:
    return Decimal(s.replace(".", "").replace(",", "."))


def _is_ignored(line: str) -> bool:
    if not line:
        return True
    if IGNORE_PAGE_RE.match(line):
        return True
    return line.startswith(IGNORE_PREFIX_LITERALS)


def parse_text_lines(lines: list[str], source_name: str = "") -> list[PdfTransaction]:
    """
    Parsea una lista de líneas (tal como salen de pypdf.extract_text) en
    movimientos. El orden de salida replica el orden de entrada (reverse
    chronological: más reciente primero).

    Separado de `parse_pdf` para que los tests unitarios puedan probar el
    parser con líneas sintéticas sin generar PDFs reales.

    Máquina de estados forward anclada en la línea de importe:

      - Al ver una fecha: abre transacción (o, si ya hay una abierta sin
        cerrar, lo que viene es la fecha valor — ignoramos la segunda).
      - Al ver la línea de importe: cierra transacción.
      - Líneas intermedias: concepto (primera) y meta (siguientes).

    Este diseño soporta el caso en que data_operació y data_valor salen en
    líneas separadas (típico en transferencias con valor diferido), que
    rompía un parser basado en lookahead fijo.
    """
    rows: list[PdfTransaction] = []
    cur_date: date | None = None
    cur_concepto: list[str] = []
    cur_meta: list[str] = []

    def _flush(importe_raw: str, saldo_raw: str) -> None:
        nonlocal cur_date, cur_concepto, cur_meta
        if cur_date is None:
            # Importe sin fecha previa — anómalo (encabezado suelto), ignorar
            cur_concepto = []
            cur_meta = []
            return
        try:
            importe = parse_eur(importe_raw)
            saldo = parse_eur(saldo_raw)
        except Exception:
            cur_date = None
            cur_concepto = []
            cur_meta = []
            return
        rows.append(
            PdfTransaction(
                booking_date=cur_date,
                concepto=" ".join(s.strip() for s in cur_concepto if s.strip()).strip(),
                meta=" | ".join(s.strip() for s in cur_meta if s.strip()).strip(),
                amount_abs=importe,
                saldo_after=saldo,
                source_pdf=source_name,
                row_index_in_pdf=len(rows),
            )
        )
        cur_date = None
        cur_concepto = []
        cur_meta = []

    for line in lines:
        if _is_ignored(line):
            continue

        m_amt = AMOUNT_LINE_RE.match(line)
        if m_amt:
            _flush(m_amt.group(1), m_amt.group(2))
            continue

        m_date = DATE_RE.match(line)
        if m_date:
            try:
                parsed = datetime.strptime(m_date.group(1), "%d-%m-%Y").date()
            except ValueError:
                continue
            rest = (m_date.group(2) or "").strip()
            if cur_date is None:
                # Abre nueva transacción con esta fecha como booking_date
                cur_date = parsed
                if rest:
                    cur_concepto.append(rest)
            else:
                # Ya hay una transacción abierta: esta es la data valor (no
                # la usamos), o el concepto viene en el "resto" de esta línea.
                if rest:
                    # Si la primera fecha venía sola, el concepto real va aquí
                    cur_concepto.append(rest)
            continue

        # Ni fecha ni importe ni header: es concepto (si aún no hay) o meta
        if cur_date is None:
            # Línea suelta fuera de transacción (pie de página fragmentado)
            continue
        if not cur_concepto:
            cur_concepto.append(line.strip())
        else:
            cur_meta.append(line.strip())

    return rows


def parse_pdf(path: Path) -> list[PdfTransaction]:
    """
    Lee un PDF de extracto CaixaBank y devuelve sus movimientos en el
    orden del PDF (reverse chronological).
    """
    reader = PdfReader(str(path))
    lines: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        for raw in text.splitlines():
            stripped = raw.rstrip()
            if stripped:
                lines.append(stripped)
    return parse_text_lines(lines, source_name=path.name)


def _chunk_sort_key(path: Path) -> tuple:
    """
    Ordena ficheros "cuenta_XXXX.1.pdf" ... "cuenta_XXXX.6.pdf" de forma que
    el chunk MÁS ANTIGUO (mayor número) quede PRIMERO en la lista, y el MÁS
    RECIENTE (número 1) al final. Si no casa el patrón, usa mtime.
    """
    m = re.search(r"\.(\d+)\.pdf$", path.name, re.IGNORECASE)
    if m:
        # Número alto = más antiguo → ordena descendente por número
        return (0, -int(m.group(1)), path.name)
    return (1, path.stat().st_mtime, path.name)


def parse_many(paths: list[Path]) -> list[PdfTransaction]:
    """
    Parsea varios PDFs y devuelve todas las filas en **orden cronológico
    ascendente** (más antigua primero), listas para firmar por delta.
    """
    ordered = sorted(paths, key=_chunk_sort_key)
    chronological: list[PdfTransaction] = []
    for p in ordered:
        pdf_rows = parse_pdf(p)
        # Dentro de un PDF, el orden es reverse chronological → invertimos
        chronological.extend(reversed(pdf_rows))
    return chronological


def sign_rows_by_delta(rows_chronological: list[PdfTransaction]) -> None:
    """
    Asigna `amount` firmado a cada fila. Modifica la lista in-place.

    Primera fila (la más antigua del conjunto): asumimos que el saldo
    anterior era 0 (cuenta recién abierta). Si esa hipótesis es consistente
    con el saldo y el importe absoluto, firmamos; si no, marcamos unknown.
    Esto cubre el caso de las líneas de crédito (primera disposición deja
    saldo negativo = magnitud del importe).
    """
    TOL = Decimal("0.01")
    for idx, row in enumerate(rows_chronological):
        if idx == 0:
            if abs(row.saldo_after - row.amount_abs) <= TOL:
                row.amount = row.amount_abs
                row.sign_source = "opening_positive"
            elif abs(row.saldo_after + row.amount_abs) <= TOL:
                row.amount = -row.amount_abs
                row.sign_source = "opening_negative"
            else:
                # El saldo previo NO era cero (la cuenta ya tenía dinero antes
                # del primer movimiento extractado). No podemos inferir signo.
                row.amount = None
                row.sign_source = "unknown"
            continue

        prev = rows_chronological[idx - 1]
        delta = row.saldo_after - prev.saldo_after
        if abs(abs(delta) - row.amount_abs) <= TOL:
            row.amount = delta
            row.sign_source = "delta"
        else:
            # Descuadre: hay una fila intermedia que no hemos parseado, o el
            # PDF tiene un agujero entre chunks. Dejamos sin firmar.
            row.amount = None
            row.sign_source = f"mismatch:delta={delta}"


# ---------------------------------------------------------------------------
# Categorización (misma idea que import_n43)
# ---------------------------------------------------------------------------

def categorize(description: str, rules: list[dict[str, Any]]) -> str:
    text = description or ""
    for rule in sorted(rules, key=lambda r: r.get("priority", 100)):
        if not rule.get("active", True):
            continue
        pattern = rule.get("pattern", "")
        if not pattern:
            continue
        try:
            if re.search(pattern, text):
                return rule["category"]
        except re.error:
            continue
    return "SIN_CATEGORIZAR"


# ---------------------------------------------------------------------------
# Cliente Supabase REST minimal
# ---------------------------------------------------------------------------

class SupabaseRest:
    def __init__(self, url: str, service_key: str) -> None:
        self.url = url.rstrip("/")
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation,resolution=merge-duplicates",
        }

    def _request(self, method: str, path: str, body: Any = None) -> Any:
        data = json.dumps(body).encode() if body is not None else None
        req = urlrequest.Request(
            f"{self.url}{path}", data=data, method=method, headers=self.headers
        )
        try:
            with urlrequest.urlopen(req) as resp:
                raw = resp.read()
                return json.loads(raw) if raw else None
        except HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Supabase HTTP {e.code}: {err_body}") from e

    def select(self, table: str, query: str = "") -> list[dict[str, Any]]:
        return self._request("GET", f"/rest/v1/{table}?{query}") or []

    def upsert(
        self, table: str, rows: list[dict[str, Any]], on_conflict: str
    ) -> list[dict[str, Any]]:
        return self._request(
            "POST",
            f"/rest/v1/{table}?on_conflict={on_conflict}",
            rows,
        ) or []


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

def to_db_row(
    tx: PdfTransaction, bank_account_id: int, category: str
) -> dict:
    # Si no hemos podido firmar (primera fila del conjunto), graba como
    # positivo por defecto con marca en raw_payload para revisión manual.
    if tx.amount is None:
        amount_value = tx.amount_abs
    else:
        amount_value = tx.amount

    return {
        "bank_account_id": bank_account_id,
        "external_id": tx.external_id(bank_account_id),
        "booking_date": tx.booking_date.isoformat(),
        "value_date": tx.booking_date.isoformat(),
        "amount": str(amount_value),
        "currency": "EUR",
        "counterparty_name": "",
        "description": tx.description[:500],
        "balance_after": str(tx.saldo_after),
        "raw_payload": {
            "source": "caixabank_pdf",
            "source_pdf": tx.source_pdf,
            "row_index_in_pdf": tx.row_index_in_pdf,
            "sign_source": tx.sign_source,
            "amount_abs": str(tx.amount_abs),
            "concepto_raw": tx.concepto,
            "meta_raw": tx.meta,
        },
        "category": category,
    }


def run_import(
    files: list[Path],
    bank_account_id: int,
    dry_run: bool,
) -> dict:
    rows = parse_many(files)
    if not rows:
        return {"error": "Ningún movimiento parseado de los PDFs", "imported": 0}

    sign_rows_by_delta(rows)
    unsigned = [r for r in rows if r.sign_source != "delta"]

    summary = {
        "files": [f.name for f in sorted(files, key=_chunk_sort_key)],
        "transactions_parsed": len(rows),
        "signed_by_delta": sum(1 for r in rows if r.sign_source == "delta"),
        "unsigned": len(unsigned),
        "first_date": rows[0].booking_date.isoformat(),
        "last_date": rows[-1].booking_date.isoformat(),
        "unsigned_detail": [
            {
                "date": r.booking_date.isoformat(),
                "concepto": r.concepto,
                "amount_abs": str(r.amount_abs),
                "saldo_after": str(r.saldo_after),
                "sign_source": r.sign_source,
                "source_pdf": r.source_pdf,
            }
            for r in unsigned
        ],
    }

    if dry_run:
        # Añade 5 ejemplos de ingresos y 5 de gastos para sanity check visual
        def _sample(r: PdfTransaction) -> dict:
            return {
                "date": r.booking_date.isoformat(),
                "amount": str(r.amount),
                "concepto": r.concepto,
            }
        summary["sample_ingresos"] = [_sample(r) for r in rows if r.amount is not None and r.amount > 0][:5]
        summary["sample_gastos"] = [_sample(r) for r in rows if r.amount is not None and r.amount < 0][:5]
        return summary

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError(
            "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno"
        )

    client = SupabaseRest(url, key)
    accounts_db = client.select(
        "bank_accounts",
        f"id=eq.{bank_account_id}&select=id,company_id,alias",
    )
    if not accounts_db:
        raise RuntimeError(f"bank_account_id={bank_account_id} no existe")
    company_id = accounts_db[0]["company_id"]
    rules = client.select(
        "bank_category_rules",
        f"company_id=eq.{company_id}&active=eq.true&select=*",
    )

    db_rows = [to_db_row(r, bank_account_id, categorize(r.description, rules)) for r in rows]

    inserted = 0
    for i in range(0, len(db_rows), 200):
        chunk = db_rows[i : i + 200]
        result = client.upsert(
            "bank_transactions", chunk, on_conflict="bank_account_id,external_id"
        )
        inserted += len(result)

    client._request(
        "PATCH",
        f"/rest/v1/bank_accounts?id=eq.{bank_account_id}",
        {"last_synced_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")},
    )

    summary["account"] = accounts_db[0]["alias"]
    summary["rows_upserted"] = inserted
    summary["dry_run"] = False
    return summary


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _collect_files(args: argparse.Namespace) -> list[Path]:
    if args.file:
        return [args.file]
    if args.dir:
        pattern = args.match or "*.pdf"
        matches = sorted(Path(args.dir).glob(pattern))
        if not matches:
            raise SystemExit(f"No matches for {pattern} in {args.dir}")
        return matches
    raise SystemExit("Debes pasar --file o --dir")


def main() -> int:
    p = argparse.ArgumentParser(
        description="Import CaixaBank PDF extracts a bank_transactions"
    )
    p.add_argument("--account-id", type=int, required=True, help="bank_accounts.id")
    p.add_argument("--file", type=Path, help="Un solo PDF")
    p.add_argument("--dir", type=Path, help="Carpeta con PDFs")
    p.add_argument(
        "--match",
        type=str,
        help='Glob pattern dentro de --dir (ej: "cuenta_5385*.pdf")',
    )
    p.add_argument("--dry-run", action="store_true", help="No escribe en BD")
    args = p.parse_args()

    try:
        files = _collect_files(args)
        for f in files:
            if not f.exists():
                print(f"ERROR: no existe {f}", file=sys.stderr)
                return 1
        result = run_import(files, args.account_id, args.dry_run)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2

    print(json.dumps(result, indent=2, ensure_ascii=False, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
