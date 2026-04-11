#!/usr/bin/env python3
"""
Tests del parser de extractos CaixaBank en PDF.

NO depende de los PDFs reales (que son datos bancarios sensibles y no
deben commitearse): los tests alimentan `parse_text_lines` con líneas
sintéticas que reproducen los escenarios reales del formato CaixaBank.

Uso:
    python scripts/test_import_caixa_pdf.py

Sale con código 0 si todo OK, 1 si falla algún assert.
"""

from __future__ import annotations

import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from import_caixa_pdf import (  # noqa: E402
    parse_text_lines,
    parse_eur,
    sign_rows_by_delta,
    categorize,
    _chunk_sort_key,
    _is_ignored,
    PdfTransaction,
    DATE_RE,
    AMOUNT_LINE_RE,
)


passed = 0
failed = 0


def t(name: str):
    def dec(fn):
        fn.__test_name__ = name
        return fn
    return dec


def run(fn):
    global passed, failed
    name = getattr(fn, "__test_name__", fn.__name__)
    try:
        fn()
        print(f"  PASS  {name}")
        passed += 1
    except AssertionError as e:
        print(f"  FAIL  {name}: {e}")
        failed += 1
    except Exception as e:  # pragma: no cover
        print(f"  ERROR {name}: {type(e).__name__}: {e}")
        failed += 1


# ---------------------------------------------------------------------------
# Helpers de fixtures: construimos listas de líneas al estilo pypdf.extract_text
# ---------------------------------------------------------------------------

def make_fixture_newer_format() -> list[str]:
    """
    Formato moderno: INGRÉS CÀRREC SALDO, importes con sufijo " EUR".
    3 filas en reverse chronological (orden real del PDF).
    """
    return [
        "PÀG. 1",
        "DATA CONCEPTE",
        "Data Valor Oficina / Remitent INGRÉS CÀRREC SALDO",
        "09-04-2026 REY DONER KEBAB",
        "09736 / Fecha de operación: 07-0",
        "5,00 228,38 EUR",
        "08-04-2026 TRANSF AL SEU FAVOR",
        "09792 / ANA MARIA SANZ",
        "100,00 233,38 EUR",
        "07-04-2026 APERTURA CTA",
        "00569",
        "133,38 133,38 EUR",
    ]


def make_fixture_older_format() -> list[str]:
    """
    Formato antiguo (.6 chunks): `+ INGRÉS - CÀRREC = SALDO`,
    sin sufijo EUR en la línea de importe.
    """
    return [
        "PÀG. 62",
        "DATA CONCEPTE",
        "Data Valor Oficina / Remitent + INGRÉS - CÀRREC = SALDO",
        "06-10-2023 TRF.INTERNACIONAL",
        "00046 / AUTO 1",
        "4.051,11 7.617,71",
        "04-10-2023 TRANSF AL SEU FAVOR",
        "09792 / 01825611-MARIA DEL MAR G",
        "10.000,00 20.000,00",
        "03-10-2023 TRASPÀS PROPI",
        "00046",
        "10.000,00 10.000,00",
    ]


def make_fixture_split_value_date() -> list[str]:
    """
    Caso patológico real: data operació y data valor en líneas separadas,
    seguido de concepto en su propia línea. Este es el caso que rompía el
    parser basado en lookahead fijo de 2 líneas.
    """
    return [
        "17-01-2026 EESS MOLINS DE RE",
        "09736 / Fecha de operación: 15-0",
        "1,00 19.642,80 EUR",
        # Aquí llega la transferencia problemática:
        "17-01-2026",
        "19-01-2026",
        "TRANSF AL SEU FAVOR",
        "09792 / 01828623-BANCO BILBAO VI",
        "11.990,00 7.652,80 EUR",
    ]


def make_fixture_credit_line() -> list[str]:
    """Línea de crédito: saldos negativos, primera operación = disposición."""
    return [
        "DATA CONCEPTE",
        "Data Valor Oficina / Remitent INGRÉS CÀRREC SALDO",
        "26-03-2025 RICARD CODINA , U",
        "00046 / RICARD CODINA LUDEÑA",
        "7.438,00 -7.438,00 EUR",
    ]


# ---------------------------------------------------------------------------
# Tests de helpers puros
# ---------------------------------------------------------------------------

@t("parse_eur convierte formato español con puntos de millar")
def test_parse_eur():
    assert parse_eur("1.234,56") == Decimal("1234.56")
    assert parse_eur("228,38") == Decimal("228.38")
    assert parse_eur("-7.438,00") == Decimal("-7438.00")
    assert parse_eur("10.000,00") == Decimal("10000.00")


@t("DATE_RE matchea fecha con y sin concepto")
def test_date_re():
    m = DATE_RE.match("09-04-2026 REY DONER KEBAB")
    assert m and m.group(1) == "09-04-2026"
    assert m.group(2) == "REY DONER KEBAB"

    m = DATE_RE.match("17-01-2026")
    assert m and m.group(1) == "17-01-2026"
    assert m.group(2) is None


@t("AMOUNT_LINE_RE matchea con y sin EUR, y con saldo negativo")
def test_amount_line_re():
    m = AMOUNT_LINE_RE.match("5,00 228,38 EUR")
    assert m and m.group(1) == "5,00" and m.group(2) == "228,38"

    # Formato antiguo sin EUR
    m = AMOUNT_LINE_RE.match("4.051,11 7.617,71")
    assert m and m.group(1) == "4.051,11" and m.group(2) == "7.617,71"

    # Línea de crédito: saldo negativo
    m = AMOUNT_LINE_RE.match("7.438,00 -7.438,00 EUR")
    assert m and m.group(1) == "7.438,00" and m.group(2) == "-7.438,00"

    # Línea "Fecha de operación" NO debe matchear como amount
    assert AMOUNT_LINE_RE.match("09736 / Fecha de operación: 07-0") is None


@t("_is_ignored descarta cabeceras y pie legal")
def test_is_ignored():
    assert _is_ignored("PÀG. 1")
    assert _is_ignored("PAG. 62")
    assert _is_ignored("DATA CONCEPTE")
    assert _is_ignored("Data Valor Oficina / Remitent INGRÉS CÀRREC SALDO")
    assert _is_ignored("El titular/autoritzat ha sol·licitat")
    assert _is_ignored("CaixaBank, S.A. Carrer Pintor Sorolla")
    # NO debe descartar líneas de movimientos reales
    assert not _is_ignored("09-04-2026 REY DONER KEBAB")
    assert not _is_ignored("5,00 228,38 EUR")
    assert not _is_ignored("09736 / Fecha de operación: 07-0")


@t("_chunk_sort_key ordena .6 antes que .1 (más antiguo primero)")
def test_chunk_sort_key():
    paths = [
        Path("cuenta_5385.1.pdf"),
        Path("cuenta_5385.3.pdf"),
        Path("cuenta_5385.6.pdf"),
        Path("cuenta_5385.2.pdf"),
    ]
    ordered = sorted(paths, key=_chunk_sort_key)
    assert [p.name for p in ordered] == [
        "cuenta_5385.6.pdf",
        "cuenta_5385.3.pdf",
        "cuenta_5385.2.pdf",
        "cuenta_5385.1.pdf",
    ], f"orden incorrecto: {[p.name for p in ordered]}"


# ---------------------------------------------------------------------------
# Tests del parser parse_text_lines
# ---------------------------------------------------------------------------

@t("parse_text_lines formato moderno: 3 movimientos extraídos")
def test_parse_newer():
    rows = parse_text_lines(make_fixture_newer_format(), source_name="test_new.pdf")
    assert len(rows) == 3, f"esperadas 3 filas, got {len(rows)}"
    r0 = rows[0]
    assert r0.booking_date.isoformat() == "2026-04-09"
    assert r0.concepto == "REY DONER KEBAB"
    assert "09736" in r0.meta
    assert r0.amount_abs == Decimal("5.00")
    assert r0.saldo_after == Decimal("228.38")
    assert r0.source_pdf == "test_new.pdf"


@t("parse_text_lines formato antiguo (sin EUR) funciona igual")
def test_parse_older():
    rows = parse_text_lines(make_fixture_older_format())
    assert len(rows) == 3
    assert rows[0].concepto == "TRF.INTERNACIONAL"
    assert rows[0].amount_abs == Decimal("4051.11")
    assert rows[0].saldo_after == Decimal("7617.71")
    assert "AUTO 1" in rows[0].meta


@t("parse_text_lines soporta data valor en línea separada")
def test_parse_split_value_date():
    rows = parse_text_lines(make_fixture_split_value_date())
    assert len(rows) == 2, f"esperadas 2 filas, got {len(rows)}: {[r.concepto for r in rows]}"
    # Primera fila: EESS
    assert rows[0].concepto == "EESS MOLINS DE RE"
    assert rows[0].amount_abs == Decimal("1.00")
    # Segunda fila: la TRANSF problemática
    tx = rows[1]
    assert tx.booking_date.isoformat() == "2026-01-17"
    assert tx.concepto == "TRANSF AL SEU FAVOR"
    assert "BANCO BILBAO" in tx.meta
    assert tx.amount_abs == Decimal("11990.00")
    assert tx.saldo_after == Decimal("7652.80")


@t("parse_text_lines ignora cabeceras PÀG y filas de encabezado")
def test_parse_ignores_headers():
    lines = make_fixture_newer_format() + [
        "PÀG. 2",
        "DATA CONCEPTE",
        "Data Valor Oficina / Remitent INGRÉS CÀRREC SALDO",
        "06-04-2026 GASOLINERA",
        "00569 / ref",
        "30,00 103,38 EUR",
    ]
    rows = parse_text_lines(lines)
    assert len(rows) == 4
    assert rows[3].concepto == "GASOLINERA"


# ---------------------------------------------------------------------------
# Tests de sign_rows_by_delta
# ---------------------------------------------------------------------------

def _build_chronological_from(lines: list[str]) -> list[PdfTransaction]:
    """
    parse_text_lines devuelve en orden reverse chronological (orden del PDF),
    y la pipeline real llama reversed() + sign_rows_by_delta. Replicamos eso.
    """
    rows = parse_text_lines(lines)
    chrono = list(reversed(rows))
    sign_rows_by_delta(chrono)
    return chrono


@t("sign_rows_by_delta marca ingresos y cargos vía delta de saldos")
def test_sign_by_delta():
    rows = _build_chronological_from(make_fixture_newer_format())
    # Orden cronológico: 07-04 apertura → 08-04 TRANSF → 09-04 KEBAB
    assert rows[0].concepto == "APERTURA CTA"
    assert rows[0].sign_source == "opening_positive"
    assert rows[0].amount == Decimal("133.38")

    assert rows[1].concepto == "TRANSF AL SEU FAVOR"
    assert rows[1].sign_source == "delta"
    assert rows[1].amount == Decimal("100.00")  # ingreso: saldo 133.38 → 233.38

    assert rows[2].concepto == "REY DONER KEBAB"
    assert rows[2].sign_source == "delta"
    assert rows[2].amount == Decimal("-5.00")  # cargo: saldo 233.38 → 228.38


@t("sign_rows_by_delta: línea de crédito detecta opening_negative")
def test_sign_credit_line_opening():
    rows = _build_chronological_from(make_fixture_credit_line())
    assert len(rows) == 1
    assert rows[0].sign_source == "opening_negative"
    assert rows[0].amount == Decimal("-7438.00")


@t("sign_rows_by_delta: fila inicial con saldo previo > 0 queda unknown")
def test_sign_unknown_when_prior_balance_nonzero():
    # Fixture de una sola fila donde saldo_after (1000) != ± amount_abs (50):
    # la cuenta tenía ~950 o ~1050 antes, no podemos inferir el signo.
    lines = [
        "01-10-2023 ENERGYGO",
        "00569 / rebut",
        "50,00 1.000,00 EUR",
    ]
    rows = _build_chronological_from(lines)
    assert len(rows) == 1
    assert rows[0].amount is None
    assert rows[0].sign_source == "unknown"


@t("sign_rows_by_delta: mismatch delta vs importe deja fila sin firmar")
def test_sign_mismatch_unsigned():
    # Construimos manualmente una cadena cronológica con un hueco artificial:
    # delta(saldo) != ±amount_abs de la segunda fila.
    from datetime import date
    a = PdfTransaction(
        booking_date=date(2024, 1, 1),
        concepto="A",
        meta="",
        amount_abs=Decimal("100"),
        saldo_after=Decimal("100"),
    )
    b = PdfTransaction(
        booking_date=date(2024, 1, 2),
        concepto="B",
        meta="",
        amount_abs=Decimal("50"),           # dice 50 pero el saldo salta 999
        saldo_after=Decimal("1099"),
    )
    rows = [a, b]
    sign_rows_by_delta(rows)
    assert rows[0].sign_source == "opening_positive"
    assert rows[1].amount is None
    assert rows[1].sign_source.startswith("mismatch")


# ---------------------------------------------------------------------------
# Tests de external_id (idempotencia)
# ---------------------------------------------------------------------------

@t("external_id es estable para el mismo movimiento")
def test_external_id_stable():
    rows_a = parse_text_lines(make_fixture_newer_format())
    rows_b = parse_text_lines(make_fixture_newer_format())
    for a, b in zip(rows_a, rows_b):
        assert a.external_id(2) == b.external_id(2)


@t("external_id cambia si cambia el bank_account_id")
def test_external_id_varies_by_account():
    rows = parse_text_lines(make_fixture_newer_format())
    ids_1 = {r.external_id(1) for r in rows}
    ids_2 = {r.external_id(2) for r in rows}
    assert ids_1.isdisjoint(ids_2)


@t("external_id NO depende del signo detectado (amount_abs es estable)")
def test_external_id_ignores_sign():
    # Re-parsear el mismo PDF debe dar mismo id incluso si el sign_source
    # cambia entre corridas (por ejemplo si un chunk adicional cambia el
    # contexto de delta). Verificamos hasheando amount_abs y no amount.
    rows = parse_text_lines(make_fixture_newer_format())
    ids_before = [r.external_id(2) for r in rows]

    # Modificamos amount/sign_source pero no amount_abs
    chrono = list(reversed(rows))
    sign_rows_by_delta(chrono)
    ids_after = [r.external_id(2) for r in rows]
    assert ids_before == ids_after


# ---------------------------------------------------------------------------
# Tests de categorización (misma semántica que import_n43)
# ---------------------------------------------------------------------------

@t("categorize aplica reglas por prioridad")
def test_categorize():
    rules = [
        {"pattern": r"(?i)auto1|auto 1", "category": "COMPRA_VEHICULO", "priority": 10, "active": True},
        {"pattern": r"(?i)tgss|seguridad social", "category": "AUTONOMO_CUOTA", "priority": 20, "active": True},
        {"pattern": r"(?i)i\.r\.p\.f|mod\. 130", "category": "IMPUESTO_IRPF", "priority": 20, "active": True},
    ]
    assert categorize("TRF.INTERNACIONAL | 00046 / AUTO 1", rules) == "COMPRA_VEHICULO"
    assert categorize("TGSS.COTIZACION 0", rules) == "AUTONOMO_CUOTA"
    assert categorize("I.R.P.F. MOD. 130", rules) == "IMPUESTO_IRPF"
    assert categorize("REY DONER KEBAB", rules) == "SIN_CATEGORIZAR"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    tests = [
        test_parse_eur,
        test_date_re,
        test_amount_line_re,
        test_is_ignored,
        test_chunk_sort_key,
        test_parse_newer,
        test_parse_older,
        test_parse_split_value_date,
        test_parse_ignores_headers,
        test_sign_by_delta,
        test_sign_credit_line_opening,
        test_sign_unknown_when_prior_balance_nonzero,
        test_sign_mismatch_unsigned,
        test_external_id_stable,
        test_external_id_varies_by_account,
        test_external_id_ignores_sign,
        test_categorize,
    ]
    for fn in tests:
        run(fn)
    print(f"\n{passed} passed, {failed} failed")
    sys.exit(0 if failed == 0 else 1)
