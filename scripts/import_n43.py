#!/usr/bin/env python3
"""
Importador de extractos bancarios CaixaBank en formato Norma 43 (Cuaderno 43).

La Norma 43 (CSB-43) es el formato estándar español de fichero de extractos
bancarios — texto plano, ASCII (cp1252 en CaixaBank), líneas de 80 caracteres,
todos los registros tienen un código de 2 dígitos al inicio:

  11  Cabecera de cuenta (IBAN, fechas, saldo inicial)
  22  Movimiento (fecha operación, fecha valor, importe, concepto, referencia)
  23  Concepto adicional del movimiento anterior (hasta 5 líneas, opcional)
  24  Movimiento referencia complementaria (opcional)
  33  Pie de cuenta (totales, saldo final)
  88  Pie de fichero

Spec pública: Consejo Superior Bancario, Cuaderno 43 v6 (2009).

Uso:
    python scripts/import_n43.py --account-id 2 --file extracto.n43
    python scripts/import_n43.py --account-id 2 --file extracto.n43 --dry-run

Variables de entorno requeridas:
    SUPABASE_URL                 (mismo valor que VITE_SUPABASE_URL)
    SUPABASE_SERVICE_ROLE_KEY    service_role para upsert (NO la anon)

Idempotencia:
    external_id = sha1(account_id + booking_date + amount + concept + ref)
    Re-ejecutar el script con el mismo fichero NO duplica filas (UNIQUE
    en bank_transactions(bank_account_id, external_id)).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from dataclasses import dataclass, field, asdict
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any
from urllib import request as urlrequest
from urllib.error import HTTPError

# ---------------------------------------------------------------------------
# Constantes Norma 43
# ---------------------------------------------------------------------------

ENCODING = "cp1252"  # CaixaBank emite N43 en Windows-1252
LINE_LEN = 80

REC_HEADER = "11"     # Cabecera cuenta
REC_TX = "22"         # Movimiento
REC_CONCEPT = "23"    # Concepto extendido del movimiento previo
REC_TX_REF = "24"     # Referencia complementaria
REC_FOOTER = "33"     # Pie de cuenta
REC_FILE_END = "88"   # Fin de fichero


# ---------------------------------------------------------------------------
# Estructuras
# ---------------------------------------------------------------------------

@dataclass
class N43Transaction:
    booking_date: date
    value_date: date
    amount: Decimal             # positivo ingreso, negativo gasto
    concept_code: str           # código común CSB
    concept_origin: str         # 4 dígitos, casi nadie los usa
    reference1: str
    reference2: str
    description_lines: list[str] = field(default_factory=list)
    balance_after: Decimal | None = None
    raw_lines: list[str] = field(default_factory=list)

    @property
    def description(self) -> str:
        # Concatena descripciones extendidas (registros 23) sin repetir
        # whitespace y limpiando.
        parts = [line.strip() for line in self.description_lines if line.strip()]
        if not parts:
            # Fallback a las referencias si no hay descripción extendida
            parts = [self.reference1.strip(), self.reference2.strip()]
            parts = [p for p in parts if p]
        return " | ".join(parts)

    def external_id(self, bank_account_id: int) -> str:
        """SHA1 estable: si re-importas el mismo fichero no duplicas filas."""
        h = hashlib.sha1()
        h.update(str(bank_account_id).encode())
        h.update(self.booking_date.isoformat().encode())
        h.update(self.value_date.isoformat().encode())
        h.update(str(self.amount).encode())
        h.update(self.reference1.encode())
        h.update(self.reference2.encode())
        h.update(self.concept_code.encode())
        # Si dos movimientos exactamente iguales en mismo día con misma referencia
        # ocurren (raro pero posible), añadimos índice de raw_lines para
        # desempate. Suficiente porque CaixaBank emite las líneas en orden.
        h.update("\n".join(self.raw_lines).encode())
        return h.hexdigest()


@dataclass
class N43Account:
    bank_code: str
    branch_code: str
    account_number: str
    start_date: date
    end_date: date
    initial_balance: Decimal
    final_balance: Decimal | None = None
    currency_code: str = "978"
    transactions: list[N43Transaction] = field(default_factory=list)

    @property
    def iban_fragment(self) -> str:
        return f"{self.bank_code}-{self.branch_code}-{self.account_number}"


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

def _parse_date(s: str) -> date:
    """N43 usa AAMMDD."""
    return datetime.strptime(s, "%y%m%d").date()


def _parse_amount(sign: str, raw: str) -> Decimal:
    """
    N43 codifica el importe en céntimos sin separador, signo aparte:
        sign='1' → debe (negativo)
        sign='2' → haber (positivo)
    """
    cents = int(raw)
    value = Decimal(cents) / Decimal(100)
    if sign == "1":
        value = -value
    return value


def parse_n43(content: str) -> list[N43Account]:
    """Devuelve la(s) cuenta(s) presentes en el fichero N43."""
    accounts: list[N43Account] = []
    current_account: N43Account | None = None
    current_tx: N43Transaction | None = None

    lines = content.splitlines()
    for line_no, raw_line in enumerate(lines, 1):
        if not raw_line.strip():
            continue
        # Acepta líneas <80 (algunas implementaciones recortan trailing spaces)
        line = raw_line.ljust(LINE_LEN)
        rec = line[:2]

        if rec == REC_HEADER:
            current_tx = None
            try:
                current_account = N43Account(
                    bank_code=line[2:6].strip(),
                    branch_code=line[6:10].strip(),
                    account_number=line[10:20].strip(),
                    start_date=_parse_date(line[20:26]),
                    end_date=_parse_date(line[26:32]),
                    initial_balance=_parse_amount(line[32:33], line[33:47]),
                    currency_code=line[47:50].strip() or "978",
                )
                accounts.append(current_account)
            except Exception as e:
                raise ValueError(
                    f"Línea {line_no}: cabecera 11 mal formada: {e}\n  {line!r}"
                ) from e

        elif rec == REC_TX:
            if current_account is None:
                raise ValueError(f"Línea {line_no}: registro 22 sin cabecera 11")
            try:
                tx = N43Transaction(
                    booking_date=_parse_date(line[10:16]),
                    value_date=_parse_date(line[16:22]),
                    concept_code=line[22:24].strip(),
                    concept_origin=line[24:28].strip(),
                    amount=_parse_amount(line[27:28], line[28:42]),
                    reference1=line[42:52].strip(),
                    reference2=line[52:64].strip(),
                    raw_lines=[line.rstrip()],
                )
            except Exception as e:
                raise ValueError(
                    f"Línea {line_no}: movimiento 22 mal formado: {e}\n  {line!r}"
                ) from e
            current_account.transactions.append(tx)
            current_tx = tx

        elif rec == REC_CONCEPT:
            if current_tx is None:
                # Concepto huérfano: lo ignoramos en lugar de explotar
                continue
            # Registro 23: posición 4-39 y 39-79 son dos campos de descripción
            desc_a = line[4:39].strip()
            desc_b = line[39:79].strip()
            for d in (desc_a, desc_b):
                if d:
                    current_tx.description_lines.append(d)
            current_tx.raw_lines.append(line.rstrip())

        elif rec == REC_TX_REF:
            if current_tx is not None:
                current_tx.raw_lines.append(line.rstrip())

        elif rec == REC_FOOTER:
            if current_account is None:
                raise ValueError(f"Línea {line_no}: pie 33 sin cabecera 11")
            try:
                current_account.final_balance = _parse_amount(
                    line[59:60], line[60:74]
                )
            except Exception:
                # Algunas variantes usan otra posición; no es crítico
                pass
            current_tx = None

        elif rec == REC_FILE_END:
            current_tx = None
            current_account = None

        # registros desconocidos: ignorar (compatibilidad futura)

    return accounts


# ---------------------------------------------------------------------------
# Categorización (aplica reglas guardadas en BD)
# ---------------------------------------------------------------------------

def categorize(description: str, rules: list[dict[str, Any]]) -> str:
    """Aplica las reglas en orden de prioridad. Primera que coincide gana."""
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
# Cliente Supabase REST minimal (sin dependencias externas)
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
# Pipeline import
# ---------------------------------------------------------------------------

def to_db_row(
    tx: N43Transaction, bank_account_id: int, category: str, raw_payload: dict
) -> dict:
    return {
        "bank_account_id": bank_account_id,
        "external_id": tx.external_id(bank_account_id),
        "booking_date": tx.booking_date.isoformat(),
        "value_date": tx.value_date.isoformat(),
        "amount": str(tx.amount),
        "currency": "EUR",
        "counterparty_name": "",
        "description": tx.description[:500],
        "balance_after": str(tx.balance_after) if tx.balance_after is not None else None,
        "raw_payload": raw_payload,
        "category": category,
    }


def run_import(file_path: Path, bank_account_id: int, dry_run: bool) -> dict:
    content = file_path.read_text(encoding=ENCODING, errors="replace")
    accounts = parse_n43(content)
    if not accounts:
        return {"error": "Fichero vacío o sin registros 11", "imported": 0}

    all_txs: list[tuple[N43Transaction, dict]] = []
    for acc in accounts:
        for tx in acc.transactions:
            all_txs.append(
                (
                    tx,
                    {
                        "n43_account": asdict(acc) | {
                            "transactions": None,  # evitar duplicar
                            "start_date": acc.start_date.isoformat(),
                            "end_date": acc.end_date.isoformat(),
                            "initial_balance": str(acc.initial_balance),
                            "final_balance": (
                                str(acc.final_balance)
                                if acc.final_balance is not None
                                else None
                            ),
                        },
                        "raw": tx.raw_lines,
                    },
                )
            )

    if dry_run:
        return {
            "dry_run": True,
            "accounts": len(accounts),
            "transactions": len(all_txs),
            "first_5": [
                {
                    "date": tx.booking_date.isoformat(),
                    "amount": str(tx.amount),
                    "description": tx.description[:80],
                }
                for tx, _ in all_txs[:5]
            ],
        }

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError(
            "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno"
        )

    client = SupabaseRest(url, key)

    # Cargar reglas activas para esta company (vía bank_account)
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

    rows = [
        to_db_row(tx, bank_account_id, categorize(tx.description, rules), payload)
        for tx, payload in all_txs
    ]

    # Upsert por chunks de 200 (límite razonable de PostgREST)
    inserted = 0
    for i in range(0, len(rows), 200):
        chunk = rows[i : i + 200]
        result = client.upsert(
            "bank_transactions", chunk, on_conflict="bank_account_id,external_id"
        )
        inserted += len(result)

    # Actualizar last_synced_at
    client._request(
        "PATCH",
        f"/rest/v1/bank_accounts?id=eq.{bank_account_id}",
        {"last_synced_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")},
    )

    return {
        "dry_run": False,
        "account": accounts_db[0]["alias"],
        "n43_accounts_in_file": len(accounts),
        "transactions_in_file": len(all_txs),
        "rows_upserted": inserted,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Import N43 a bank_transactions")
    parser.add_argument("--account-id", type=int, required=True, help="bank_accounts.id")
    parser.add_argument("--file", type=Path, required=True, help="Ruta al fichero N43")
    parser.add_argument("--dry-run", action="store_true", help="No escribe en BD")
    args = parser.parse_args()

    if not args.file.exists():
        print(f"ERROR: no existe {args.file}", file=sys.stderr)
        return 1

    try:
        result = run_import(args.file, args.account_id, args.dry_run)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2

    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
