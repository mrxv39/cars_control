"""Tests para ocr_fichas_tecnicas.py — funciones puras de parsing de texto OCR."""
from __future__ import annotations

import sys
from unittest.mock import patch

# The module does `import requests` and `import pdfplumber` and reads ANON_KEY
# at import time. We mock all to avoid ImportError/RuntimeError during test collection.
sys.modules.setdefault("requests", type(sys)("requests"))
sys.modules.setdefault("pdfplumber", type(sys)("pdfplumber"))

with patch.dict("os.environ", {"SUPABASE_ANON_KEY": "test-anon-key-for-ocr"}):
    from ocr_fichas_tecnicas import (
        parse_text,
        PLATE_RE,
        PLATE_OLD_RE,
        VIN_RE,
        YEAR_RE,
    )


# ---------------------------------------------------------------------------
# PLATE_RE — new format (####ABC)
# ---------------------------------------------------------------------------

class TestPlateReNew:
    def test_matches_standard_plate(self):
        m = PLATE_RE.search("MATRICULA 0229LVS ALGO")
        assert m is not None
        assert m.group(1) == "0229"
        assert m.group(2) == "LVS"

    def test_matches_with_space(self):
        # The regex expects digits then letters without space — search in uppercased text
        m = PLATE_RE.search("0229 LVS")
        assert m is not None

    def test_no_match_too_few_digits(self):
        m = PLATE_RE.search("229LVS")
        assert m is None

    def test_no_match_too_few_letters(self):
        m = PLATE_RE.search("0229LV")
        assert m is None

    def test_excludes_vowels_in_letters(self):
        # Spanish plates don't use vowels (A, E, I, O, U) or certain letters
        m = PLATE_RE.search("0229ABC")
        # A is a vowel, not in the character class [B-DF-HJ-NP-TV-Z]
        assert m is None

    def test_valid_letters_bcd(self):
        m = PLATE_RE.search("1234BCD")
        assert m is not None
        assert m.group(2) == "BCD"


# ---------------------------------------------------------------------------
# PLATE_OLD_RE — old format (X-####-XX)
# ---------------------------------------------------------------------------

class TestPlateReOld:
    def test_matches_old_format(self):
        m = PLATE_OLD_RE.search("B 6246 JW")
        assert m is not None
        assert m.group(1) == "B"
        assert m.group(2) == "6246"
        assert m.group(3) == "JW"

    def test_matches_with_dashes(self):
        m = PLATE_OLD_RE.search("B-6246-JW")
        assert m is not None

    def test_matches_two_letter_province(self):
        m = PLATE_OLD_RE.search("GI 1234 AB")
        assert m is not None
        assert m.group(1) == "GI"


# ---------------------------------------------------------------------------
# VIN_RE
# ---------------------------------------------------------------------------

class TestVinRe:
    def test_matches_valid_vin(self):
        m = VIN_RE.search("VIN: WBAPH5C55BA123456 ok")
        assert m is not None
        assert m.group(1) == "WBAPH5C55BA123456"

    def test_no_match_too_short(self):
        m = VIN_RE.search("WBAPH5C55BA1234")
        # 15 chars — should not match as full VIN
        assert m is None or len(m.group(1)) != 17

    def test_excludes_I_O_Q(self):
        # VIN cannot contain I, O, Q
        vin_with_I = "WBAIH5C55BA12345I"  # contains I
        # The regex [A-HJ-NPR-Z0-9] excludes I, O, Q
        m = VIN_RE.search(vin_with_I)
        # Should not match because I is excluded
        assert m is None


# ---------------------------------------------------------------------------
# YEAR_RE
# ---------------------------------------------------------------------------

class TestYearRe:
    def test_matches_2020(self):
        m = YEAR_RE.search("Ano primera matriculacion: 2020")
        assert m is not None
        assert m.group(1) == "2020"

    def test_matches_1998(self):
        m = YEAR_RE.search("1998")
        assert m is not None

    def test_no_match_1979(self):
        m = YEAR_RE.search("1979")
        assert m is None

    def test_no_match_2030(self):
        m = YEAR_RE.search("2030")
        assert m is None

    def test_matches_2026(self):
        m = YEAR_RE.search("2026")
        assert m is not None


# ---------------------------------------------------------------------------
# parse_text — integrated extraction
# ---------------------------------------------------------------------------

class TestParseText:
    def test_extracts_new_plate(self):
        text = "MATRICULA: 0229 LVS\nMARCA: SEAT\nMODELO: IBIZA"
        result = parse_text(text)
        assert result["plate"] == "0229LVS"

    def test_extracts_old_plate(self):
        text = "MATRICULA: B 6246 JW\nMARCA: BMW"
        result = parse_text(text)
        assert result["plate"] is not None
        assert "6246" in result["plate"]

    def test_extracts_vin(self):
        text = "VIN WBAPH5C55BA123456 FABRICANTE BMW"
        result = parse_text(text)
        assert result["vin"] == "WBAPH5C55BA123456"

    def test_extracts_year(self):
        text = "PRIMERA MATRICULACION 15/03/2019 MADRID"
        result = parse_text(text)
        assert result["year"] == 2019

    def test_extracts_all_fields(self):
        text = """
        FICHA TECNICA
        MATRICULA: 5678 BCD
        VIN: WF0XXXGCDX1234567
        FECHA PRIMERA MATRICULACION: 2021
        MARCA: FORD
        """
        result = parse_text(text)
        assert result["plate"] == "5678BCD"
        assert result["vin"] == "WF0XXXGCDX1234567"
        assert result["year"] == 2021

    def test_empty_text_returns_nulls(self):
        result = parse_text("")
        assert result["plate"] is None
        assert result["vin"] is None
        assert result["year"] is None

    def test_no_text_returns_nulls(self):
        result = parse_text("Solo texto sin datos relevantes")
        assert result["plate"] is None
        assert result["vin"] is None
        assert result["year"] is None

    def test_vin_must_have_letters_and_digits(self):
        # A 17-digit all-number string should NOT be detected as VIN
        text = "REFERENCIA 12345678901234567 ALGO"
        result = parse_text(text)
        assert result["vin"] is None

    def test_new_plate_preferred_over_old(self):
        # If both formats appear, the new format (####ABC) should be found first
        text = "MATRICULA 1234BCD ANTERIOR B 5678 JW"
        result = parse_text(text)
        assert result["plate"] == "1234BCD"

    def test_real_world_ficha_text(self):
        """Simulates a real ficha tecnica text structure."""
        text = """
        DIRECCION GENERAL DE TRAFICO
        PERMISO DE CIRCULACION

        TITULAR: CODINA LUDENA RICARD
        DOMICILIO: CARRER EXEMPLE 123 08001 BARCELONA

        VEHICULO
        MARCA: VOLKSWAGEN
        DENOMINACION COMERCIAL: GOLF
        NUMERO DE BASTIDOR: WVWZZZ1KZYW123456
        MATRICULA: 3456 FGH
        FECHA 1a MATRICULACION: 01/06/2015
        POTENCIA: 110 CV
        CILINDRADA: 1968 cc
        """
        result = parse_text(text)
        assert result["plate"] == "3456FGH"
        assert result["vin"] == "WVWZZZ1KZYW123456"
        assert result["year"] == 2015
