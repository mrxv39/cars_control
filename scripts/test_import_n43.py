#!/usr/bin/env python3
"""
Tests del parser Norma 43 + categorización.

NO toca BD ni red. Solo verifica que parse_n43() y categorize() devuelven
lo esperado contra el fixture sintético.

Uso:
    python scripts/test_import_n43.py

Sale con código 0 si todo OK, 1 si falla algún assert.
"""

from __future__ import annotations

import sys
from decimal import Decimal
from pathlib import Path

# Permite importar import_n43 desde el mismo directorio
sys.path.insert(0, str(Path(__file__).parent))
from import_n43 import parse_n43, categorize, ENCODING


FIXTURE = Path(__file__).parent / "test_data" / "sample_caixabank_autonomo.n43"

# Reglas espejo de las que viven en bank_category_rules en producción
RULES_SAMPLE = [
    {"pattern": r"(?i)auto1|carauction|bca europe", "category": "COMPRA_VEHICULO", "priority": 10, "active": True},
    {"pattern": r"(?i)ruppmann|gestor[íi]a", "category": "GESTORIA", "priority": 20, "active": True},
    {"pattern": r"(?i)agencia tributaria.*303|mod[. ]?303", "category": "IMPUESTO_303", "priority": 20, "active": True},
    {"pattern": r"(?i)tgss|seguridad social|rgta\.s\.s", "category": "AUTONOMO_CUOTA", "priority": 20, "active": True},
    {"pattern": r"(?i)comisi[óo]n|mantenimiento cuenta", "category": "COMISION_BANCO", "priority": 50, "active": True},
    {"pattern": r"(?i)repsol|cepsa|galp|bp |gasolinera", "category": "COMBUSTIBLE", "priority": 40, "active": True},
]


def t(name: str):
    """Decorador trivial para nombrar tests."""
    def decorator(fn):
        fn.__test_name__ = name
        return fn
    return decorator


passed = 0
failed = 0


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
    except Exception as e:
        print(f"  ERR   {name}: {type(e).__name__}: {e}")
        failed += 1


# ----------------------------------------------------------------
# Tests
# ----------------------------------------------------------------

@t("fixture existe y se lee con cp1252")
def test_fixture_loads():
    assert FIXTURE.exists(), f"falta fixture: {FIXTURE}"
    content = FIXTURE.read_text(encoding=ENCODING)
    assert content, "fixture vacío"
    # Debe tener al menos un registro 11 y un 33
    assert "\n11" in "\n" + content or content.startswith("11")
    assert "33" in content


@t("parse_n43 detecta 1 cuenta y 6 movimientos")
def test_parse_counts():
    content = FIXTURE.read_text(encoding=ENCODING)
    accounts = parse_n43(content)
    assert len(accounts) == 1, f"esperado 1 cuenta, got {len(accounts)}"
    assert len(accounts[0].transactions) == 6, (
        f"esperado 6 movimientos, got {len(accounts[0].transactions)}"
    )


@t("cabecera 11: banco, fechas, saldo inicial")
def test_header():
    accounts = parse_n43(FIXTURE.read_text(encoding=ENCODING))
    acc = accounts[0]
    assert acc.bank_code == "2100", f"banco {acc.bank_code}"
    assert acc.start_date.isoformat() == "2026-01-01"
    assert acc.end_date.isoformat() == "2026-01-31"
    assert acc.initial_balance == Decimal("5000.00")
    assert acc.currency_code == "978"


@t("movimiento debe (-) y haber (+) con signo correcto")
def test_amounts_signed():
    accounts = parse_n43(FIXTURE.read_text(encoding=ENCODING))
    txs = accounts[0].transactions
    # Movimiento 1: -8500 (compra Auto1)
    assert txs[0].amount == Decimal("-8500.00"), f"tx[0]={txs[0].amount}"
    # Movimiento 3: +11500 (venta)
    assert txs[2].amount == Decimal("11500.00"), f"tx[2]={txs[2].amount}"
    # Movimiento 5: -12.00 (comisión)
    assert txs[4].amount == Decimal("-12.00"), f"tx[4]={txs[4].amount}"


@t("descripción extendida concatena registros 23")
def test_description_concept():
    accounts = parse_n43(FIXTURE.read_text(encoding=ENCODING))
    txs = accounts[0].transactions
    assert "AUTO1" in txs[0].description
    assert "FACTURA AS-2026-001" in txs[0].description
    assert "RUPPMANN" in txs[1].description
    assert "TRAMITES TRAFICO" in txs[1].description


@t("external_id es estable (idempotencia)")
def test_external_id_stable():
    accounts1 = parse_n43(FIXTURE.read_text(encoding=ENCODING))
    accounts2 = parse_n43(FIXTURE.read_text(encoding=ENCODING))
    ids1 = [tx.external_id(2) for tx in accounts1[0].transactions]
    ids2 = [tx.external_id(2) for tx in accounts2[0].transactions]
    assert ids1 == ids2, "external_id varía entre re-parses"
    assert len(set(ids1)) == len(ids1), "external_ids duplicados en mismo fichero"


@t("external_id depende del bank_account_id")
def test_external_id_per_account():
    accounts = parse_n43(FIXTURE.read_text(encoding=ENCODING))
    tx = accounts[0].transactions[0]
    assert tx.external_id(2) != tx.external_id(3), (
        "external_id no debería colisionar entre cuentas distintas"
    )


@t("categorize detecta COMPRA_VEHICULO de Auto1")
def test_categorize_auto1():
    cat = categorize("TRANSFERENCIA AUTO1 EUROPEAN GMBH FACTURA AS-2026-001", RULES_SAMPLE)
    assert cat == "COMPRA_VEHICULO", f"got {cat}"


@t("categorize detecta GESTORIA Ruppmann")
def test_categorize_ruppmann():
    cat = categorize("GESTORIA RUPPMANN SL TRAMITES TRAFICO", RULES_SAMPLE)
    assert cat == "GESTORIA", f"got {cat}"


@t("categorize detecta AUTONOMO_CUOTA TGSS")
def test_categorize_tgss():
    cat = categorize("RGTA.S.S 1234567890 SEG SOCIAL", RULES_SAMPLE)
    assert cat == "AUTONOMO_CUOTA", f"got {cat}"


@t("categorize detecta COMISION_BANCO")
def test_categorize_comision():
    cat = categorize("COMISION MANTENIMIENTO CUENTA", RULES_SAMPLE)
    assert cat == "COMISION_BANCO", f"got {cat}"


@t("categorize detecta COMBUSTIBLE Repsol")
def test_categorize_repsol():
    cat = categorize("REPSOL ESTACION SERVICIO COMPRA TARJETA", RULES_SAMPLE)
    assert cat == "COMBUSTIBLE", f"got {cat}"


@t("categorize fallback SIN_CATEGORIZAR para venta a particular")
def test_categorize_unknown():
    cat = categorize("TRANSFERENCIA RECIBIDA JUAN PEREZ GOMEZ", RULES_SAMPLE)
    assert cat == "SIN_CATEGORIZAR", f"got {cat}"


@t("categorize respeta prioridad (regla más específica gana)")
def test_categorize_priority():
    rules = [
        {"pattern": r"(?i)tributaria", "category": "IMPUESTO_OTRO", "priority": 30, "active": True},
        {"pattern": r"(?i)tributaria.*303", "category": "IMPUESTO_303", "priority": 20, "active": True},
    ]
    cat = categorize("AGENCIA TRIBUTARIA MOD 303 1T 2026", rules)
    assert cat == "IMPUESTO_303", f"got {cat}"


@t("categorize ignora reglas inactivas")
def test_categorize_inactive():
    rules = [
        {"pattern": r"(?i)auto1", "category": "COMPRA_VEHICULO", "priority": 10, "active": False},
    ]
    cat = categorize("AUTO1 EUROPEAN", rules)
    assert cat == "SIN_CATEGORIZAR"


@t("categorize tolera regex inválido sin explotar")
def test_categorize_bad_regex():
    rules = [
        {"pattern": r"((bad", "category": "X", "priority": 10, "active": True},
        {"pattern": r"(?i)auto1", "category": "COMPRA_VEHICULO", "priority": 20, "active": True},
    ]
    cat = categorize("AUTO1", rules)
    assert cat == "COMPRA_VEHICULO"


# ----------------------------------------------------------------
# Runner
# ----------------------------------------------------------------

if __name__ == "__main__":
    tests = [obj for name, obj in list(globals().items()) if name.startswith("test_") and callable(obj)]
    print(f"Running {len(tests)} tests against {FIXTURE.name}\n")
    for fn in tests:
        run(fn)
    print(f"\n{passed} passed, {failed} failed")
    sys.exit(0 if failed == 0 else 1)
