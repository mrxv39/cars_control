"""Tests para import_zip_stock.py — funciones puras de SQL generation y slugify."""
from __future__ import annotations

import sys
from unittest.mock import patch

# The module does `import requests` and reads SERVICE_KEY at import time.
# We mock both to avoid ImportError and RuntimeError during test collection.
sys.modules.setdefault("requests", type(sys)("requests"))

with patch.dict("os.environ", {"SUPABASE_SERVICE_ROLE_KEY": "test-key-for-import"}):
    from import_zip_stock import slugify, sql_str, sql_bool


# ---------------------------------------------------------------------------
# slugify
# ---------------------------------------------------------------------------

class TestSlugify:
    def test_basic_ascii(self):
        assert slugify("hello world") == "hello_world"

    def test_removes_accents(self):
        result = slugify("vehiculo")
        assert result == "vehiculo"

    def test_spanish_accents(self):
        result = slugify("Vehiculo Camion")
        assert "Vehiculo" in result

    def test_special_characters(self):
        result = slugify("foto (1).jpg")
        assert result == "foto_1_.jpg"

    def test_preserves_dots_and_hyphens(self):
        result = slugify("file-name.jpg")
        assert result == "file-name.jpg"

    def test_strips_leading_trailing_underscores(self):
        result = slugify("___test___")
        assert not result.startswith("_")
        assert not result.endswith("_")

    def test_truncates_to_80_chars(self):
        long_name = "a" * 100
        result = slugify(long_name)
        assert len(result) <= 80

    def test_empty_after_stripping(self):
        # All special chars that get replaced, then stripped
        result = slugify("()")
        assert isinstance(result, str)

    def test_unicode_normalization(self):
        # n with tilde: should become n
        result = slugify("\u00f1")  # n
        assert result == "n"

    def test_consecutive_specials_collapse(self):
        result = slugify("a   b   c")
        assert result == "a_b_c"

    def test_plate_style(self):
        result = slugify("0229LVS")
        assert result == "0229LVS"


# ---------------------------------------------------------------------------
# sql_str
# ---------------------------------------------------------------------------

class TestSqlStr:
    def test_basic_string(self):
        assert sql_str("hello") == "'hello'"

    def test_none_returns_null(self):
        assert sql_str(None) == "NULL"

    def test_escapes_single_quotes(self):
        assert sql_str("it's") == "'it''s'"

    def test_double_quotes_inside(self):
        # Double quotes should pass through unchanged
        assert sql_str('say "hi"') == "'say \"hi\"'"

    def test_empty_string(self):
        assert sql_str("") == "''"

    def test_spanish_text(self):
        result = sql_str("Importado del zip (SEAT IBIZA)")
        assert result == "'Importado del zip (SEAT IBIZA)'"

    def test_multiple_quotes(self):
        assert sql_str("a'b'c") == "'a''b''c'"


# ---------------------------------------------------------------------------
# sql_bool
# ---------------------------------------------------------------------------

class TestSqlBool:
    def test_true(self):
        assert sql_bool(True) == "TRUE"

    def test_false(self):
        assert sql_bool(False) == "FALSE"
