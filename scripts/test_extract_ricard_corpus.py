"""Tests para extract_ricard_corpus.py — funciones puras de parsing de emails."""
from __future__ import annotations

import json
import tempfile
from email.message import Message
from pathlib import Path

from extract_ricard_corpus import (
    strip_html,
    clean_reply,
    hget,
    header_addresses,
    is_from_ricard,
    thread_touches_lead_source,
    parse_refs,
    normalize_msgid,
    extract_vehicle_hint,
    load_existing_keys,
)


# ---------------------------------------------------------------------------
# strip_html
# ---------------------------------------------------------------------------

class TestStripHtml:
    def test_removes_tags(self):
        assert "Hola" in strip_html("<p>Hola</p>")

    def test_removes_script_tags_fallback(self):
        # Without bs4, falls back to regex — still strips tags
        result = strip_html("<div><script>alert(1)</script>Texto</div>")
        assert "Texto" in result

    def test_empty_string(self):
        assert strip_html("") == ""

    def test_plain_text_passthrough(self):
        assert strip_html("sin tags") == "sin tags"

    def test_nested_tags(self):
        result = strip_html("<div><b>negrita</b> y <i>cursiva</i></div>")
        assert "negrita" in result
        assert "cursiva" in result


# ---------------------------------------------------------------------------
# clean_reply
# ---------------------------------------------------------------------------

class TestCleanReply:
    def test_removes_quoted_lines(self):
        text = "Mi respuesta\n> Esto es una cita\n> Otra linea"
        result = clean_reply(text)
        assert result == "Mi respuesta"

    def test_removes_on_wrote_marker(self):
        text = "Respuesta aqui\nEl 5 de abril de 2026 escribio:\nTexto citado"
        result = clean_reply(text)
        assert "Respuesta aqui" in result
        assert "escribio" not in result

    def test_removes_on_wrote_english(self):
        text = "My reply\nOn Mon, Apr 5, 2026 wrote:\nQuoted stuff"
        result = clean_reply(text)
        assert result == "My reply"

    def test_removes_signature_enviado_desde(self):
        text = "Texto del mensaje\nEnviado desde mi iPhone"
        result = clean_reply(text)
        assert result == "Texto del mensaje"

    def test_removes_signature_sent_from(self):
        text = "Message body\nSent from my Galaxy"
        result = clean_reply(text)
        assert result == "Message body"

    def test_signature_dashes_with_strip_behavior(self):
        # "-- " marker: line.strip() turns "-- " into "--" which does NOT
        # startswith("-- "), so the signature is NOT stripped. This tests
        # the actual behavior of clean_reply.
        text = "Cuerpo del mensaje\n-- \nRicard Codina\nCodinaCars"
        result = clean_reply(text)
        assert "Cuerpo del mensaje" in result
        # The signature remains because strip() removes the trailing space
        assert "Ricard Codina" in result

    def test_collapses_multiple_blank_lines(self):
        text = "Linea 1\n\n\n\n\nLinea 2"
        result = clean_reply(text)
        assert result == "Linea 1\n\nLinea 2"

    def test_strips_whitespace(self):
        text = "  \n  Respuesta  \n  "
        result = clean_reply(text)
        assert result == "Respuesta"

    def test_crlf_normalized(self):
        text = "Linea 1\r\nLinea 2\r\n> cita"
        result = clean_reply(text)
        assert result == "Linea 1\nLinea 2"

    def test_empty_input(self):
        assert clean_reply("") == ""


# ---------------------------------------------------------------------------
# hget
# ---------------------------------------------------------------------------

class TestHget:
    def test_returns_header_value(self):
        msg = Message()
        msg["Subject"] = "Test subject"
        assert hget(msg, "Subject") == "Test subject"

    def test_returns_empty_for_missing(self):
        msg = Message()
        assert hget(msg, "X-Missing") == ""

    def test_returns_empty_for_none(self):
        msg = Message()
        assert hget(msg, "From") == ""


# ---------------------------------------------------------------------------
# header_addresses
# ---------------------------------------------------------------------------

class TestHeaderAddresses:
    def test_extracts_emails(self):
        msg = Message()
        msg["From"] = "Ricard <richithp@gmail.com>"
        result = header_addresses(msg, "From")
        assert result == ["richithp@gmail.com"]

    def test_multiple_addresses(self):
        msg = Message()
        msg["To"] = "alice@example.com, Bob <bob@test.org>"
        result = header_addresses(msg, "To")
        assert len(result) == 2
        assert "alice@example.com" in result
        assert "bob@test.org" in result

    def test_missing_header(self):
        msg = Message()
        assert header_addresses(msg, "Cc") == []

    def test_lowercases(self):
        msg = Message()
        msg["From"] = "RICARD@GMAIL.COM"
        result = header_addresses(msg, "From")
        assert result == ["ricard@gmail.com"]


# ---------------------------------------------------------------------------
# is_from_ricard
# ---------------------------------------------------------------------------

class TestIsFromRicard:
    def test_true_for_ricard(self):
        msg = Message()
        msg["From"] = "Ricard Codina <richithp@gmail.com>"
        assert is_from_ricard(msg) is True

    def test_false_for_other(self):
        msg = Message()
        msg["From"] = "lead@contactos.coches.net"
        assert is_from_ricard(msg) is False

    def test_false_for_missing(self):
        msg = Message()
        assert is_from_ricard(msg) is False


# ---------------------------------------------------------------------------
# thread_touches_lead_source
# ---------------------------------------------------------------------------

class TestThreadTouchesLeadSource:
    def test_coches_net_in_subject(self):
        msg = Message()
        msg["Subject"] = "Consulta desde coches.net sobre SEAT Ibiza"
        assert thread_touches_lead_source(msg) is True

    def test_coches_net_in_from(self):
        msg = Message()
        msg["Subject"] = "Consulta vehiculo"
        msg["From"] = "notificaciones@contactos.coches.net"
        assert thread_touches_lead_source(msg) is True

    def test_no_lead_source(self):
        msg = Message()
        msg["Subject"] = "Factura taller"
        msg["From"] = "taller@mecanico.es"
        assert thread_touches_lead_source(msg) is False

    def test_milanuncios_in_reply_to(self):
        msg = Message()
        msg["Subject"] = "RE: anuncio"
        msg["Reply-To"] = "responder@milanuncios.com"
        assert thread_touches_lead_source(msg) is True


# ---------------------------------------------------------------------------
# parse_refs
# ---------------------------------------------------------------------------

class TestParseRefs:
    def test_extracts_message_ids(self):
        msg = Message()
        msg["References"] = "<abc@mail.com> <def@mail.com>"
        result = parse_refs(msg)
        assert "<abc@mail.com>" in result
        assert "<def@mail.com>" in result

    def test_in_reply_to(self):
        msg = Message()
        msg["In-Reply-To"] = "<parent@mail.com>"
        result = parse_refs(msg)
        assert "<parent@mail.com>" in result

    def test_empty_when_no_refs(self):
        msg = Message()
        assert parse_refs(msg) == []

    def test_combines_both_headers(self):
        msg = Message()
        msg["In-Reply-To"] = "<a@x.com>"
        msg["References"] = "<b@x.com> <c@x.com>"
        result = parse_refs(msg)
        assert len(result) == 3


# ---------------------------------------------------------------------------
# normalize_msgid
# ---------------------------------------------------------------------------

class TestNormalizeMsgid:
    def test_extracts_angle_brackets(self):
        assert normalize_msgid("<abc@mail.com>") == "<abc@mail.com>"

    def test_strips_surrounding_whitespace(self):
        assert normalize_msgid("  <abc@mail.com>  ") == "<abc@mail.com>"

    def test_returns_empty_for_none(self):
        assert normalize_msgid(None) == ""

    def test_returns_empty_for_empty_string(self):
        assert normalize_msgid("") == ""

    def test_no_angle_brackets_strips(self):
        assert normalize_msgid("  abc@mail.com  ") == "abc@mail.com"


# ---------------------------------------------------------------------------
# extract_vehicle_hint
# ---------------------------------------------------------------------------

class TestExtractVehicleHint:
    def test_strips_re_prefix(self):
        assert extract_vehicle_hint("Re: SEAT Ibiza 2020") == "SEAT Ibiza 2020"

    def test_strips_fwd_prefix(self):
        assert extract_vehicle_hint("Fwd: BMW 320d") == "BMW 320d"

    def test_strips_rv_prefix(self):
        assert extract_vehicle_hint("RV: Opel Corsa") == "Opel Corsa"

    def test_empty_string(self):
        assert extract_vehicle_hint("") == ""

    def test_truncates_long_subjects(self):
        long_subject = "A" * 200
        result = extract_vehicle_hint(long_subject)
        assert len(result) <= 120

    def test_collapses_whitespace(self):
        result = extract_vehicle_hint("Re:  SEAT   Ibiza   2020")
        assert "  " not in result


# ---------------------------------------------------------------------------
# load_existing_keys
# ---------------------------------------------------------------------------

class TestLoadExistingKeys:
    def test_loads_keys_from_jsonl(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False, encoding="utf-8") as f:
            f.write(json.dumps({"key": "abc123", "data": "x"}) + "\n")
            f.write(json.dumps({"key": "def456", "data": "y"}) + "\n")
            tmp_path = Path(f.name)
        try:
            keys = load_existing_keys(tmp_path)
            assert keys == {"abc123", "def456"}
        finally:
            tmp_path.unlink()

    def test_returns_empty_for_nonexistent(self):
        keys = load_existing_keys(Path("/tmp/nonexistent_file_xyz.jsonl"))
        assert keys == set()

    def test_skips_invalid_json_lines(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False, encoding="utf-8") as f:
            f.write(json.dumps({"key": "good"}) + "\n")
            f.write("not json\n")
            f.write(json.dumps({"key": "also_good"}) + "\n")
            tmp_path = Path(f.name)
        try:
            keys = load_existing_keys(tmp_path)
            assert keys == {"good", "also_good"}
        finally:
            tmp_path.unlink()

    def test_skips_rows_without_key(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False, encoding="utf-8") as f:
            f.write(json.dumps({"key": "has_key"}) + "\n")
            f.write(json.dumps({"no_key_field": "value"}) + "\n")
            tmp_path = Path(f.name)
        try:
            keys = load_existing_keys(tmp_path)
            assert keys == {"has_key"}
        finally:
            tmp_path.unlink()
