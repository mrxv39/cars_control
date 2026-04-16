"""Tests para analyze_zip_stock.py — funciones puras de análisis."""
from analyze_zip_stock import (
    extract_plate,
    guess_model,
    classify_file,
    is_sensitive_name,
    is_image,
    is_definitive_folder,
)


class TestExtractPlate:
    def test_new_format(self):
        assert extract_plate("SEAT IBIZA 0229LVS") == "0229LVS"

    def test_new_format_with_spaces(self):
        assert extract_plate("1ºt , SEAT IBIZA 0229 LVS") == "0229LVS"

    def test_old_format(self):
        assert extract_plate("BMW 320d B 6246 JW") == "B6246JW"

    def test_no_plate(self):
        assert extract_plate("SEAT IBIZA sin matricula") is None

    def test_plate_in_complex_name(self):
        assert extract_plate("3º T . OPEL CORSA 5678BCD (frenos)") == "5678BCD"


class TestGuessModel:
    def test_removes_trimester_prefix(self):
        assert guess_model("1ºT , SEAT IBIZA 0229LVS", "0229LVS") == "SEAT IBIZA"

    def test_removes_plate(self):
        assert guess_model("BMW 320d 1234ABC", "1234ABC") == "BMW 320d"

    def test_removes_noise_words(self):
        result = guess_model("2ºt . OPEL CORSA (OK frenos)", None)
        assert "OPEL CORSA" in result
        assert "OK" not in result
        assert "frenos" not in result

    def test_no_prefix(self):
        assert guess_model("VOLKSWAGEN GOLF", None) == "VOLKSWAGEN GOLF"

    def test_numeric_prefix(self):
        assert guess_model("3. PEUGEOT 208", None) == "PEUGEOT 208"


class TestClassifyFile:
    def test_factura_compra(self):
        assert classify_file("FRA COMPRA.pdf") == "factura_compra"
        assert classify_file("factura compra vehiculo.pdf") == "factura_compra"

    def test_ficha_tecnica(self):
        assert classify_file("Ficha_Tecnica  0229LVS.pdf") == "ficha_tecnica"
        assert classify_file("ficha técnica.pdf") == "ficha_tecnica"

    def test_permiso(self):
        assert classify_file("permiso.pdf") == "permiso_circulacion"

    def test_contrato(self):
        assert classify_file("contrato cv + mandato.pdf") == "contrato_venta"

    def test_dni(self):
        assert classify_file("DNI COMPRADOR , COMPLETO.pdf") == "dni_cliente"

    def test_comision(self):
        assert classify_file("comision auto1.pdf") == "factura_comision"

    def test_otros(self):
        assert classify_file("CLÁUSULA DE SUSTITUCIÓN.docx") == "otros"
        assert classify_file("random.txt") == "otros"


class TestIsSensitiveName:
    def test_dni(self):
        assert is_sensitive_name("DNI COMPRADOR.pdf") is True

    def test_nomina(self):
        assert is_sensitive_name("nómina marzo.pdf") is True

    def test_contrato(self):
        assert is_sensitive_name("contrato compraventa.pdf") is True

    def test_normal_photo(self):
        assert is_sensitive_name("foto_frontal.jpg") is False

    def test_iban(self):
        assert is_sensitive_name("datos_iban_cliente.pdf") is True

    def test_vida_laboral(self):
        assert is_sensitive_name("Vida Laboral Samuel.pdf") is True


class TestIsImage:
    def test_jpg(self):
        assert is_image("foto1.jpg") is True
        assert is_image("FOTO.JPEG") is True

    def test_png(self):
        assert is_image("captura.png") is True

    def test_pdf_not_image(self):
        assert is_image("factura.pdf") is False

    def test_webp(self):
        assert is_image("image.webp") is True


class TestIsDefinitiveFolder:
    def test_fotos_definitivas(self):
        assert is_definitive_folder("fotos definitivas") is True

    def test_fotos_finales_ok(self):
        assert is_definitive_folder("fotos finales . ok") is True
        assert is_definitive_folder("FOTOS FINALES.OK") is True

    def test_definitivas(self):
        assert is_definitive_folder("definitivas") is True

    def test_random_folder(self):
        assert is_definitive_folder("documentos") is False

    def test_nuevas(self):
        assert is_definitive_folder("fotos nuevas") is True
