"""
OCR processing of image-based invoices from GASTOS folders.
Extracts text from PDFs (rendered as images) and JPG files using Tesseract OCR.
Then parses the text to extract invoice data.
"""
import pymupdf
import pytesseract
from PIL import Image
import io
import os
import json
import re
from datetime import datetime

os.environ['TESSDATA_PREFIX'] = r'C:\Users\Usuario\tessdata'

base = r'C:\Users\Usuario\Desktop\proyectos\cars_control\docs_legacy\GASTOS\GASTOS DE LOS 4 TRIMESTRES 2025'


def parse_euro_amount(text_fragment):
    cleaned = text_fragment.strip().replace('.', '').replace(',', '.')
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def find_all_euro_amounts(text):
    matches = re.findall(r'([\d]+(?:\.[\d]{3})*(?:,[\d]{1,2}))\s*(?:\x80|€|E|Eu)', text)
    return [parse_euro_amount(m) for m in matches if parse_euro_amount(m) > 0]


def ocr_file(path):
    """Extract text from an image file or image-based PDF using OCR."""
    ext = path.lower().split('.')[-1]
    try:
        if ext in ('jpg', 'jpeg', 'png'):
            img = Image.open(path)
            return pytesseract.image_to_string(img, lang='spa+eng')
        elif ext == 'pdf':
            doc = pymupdf.open(path)
            full_text = ''
            for page in doc:
                pix = page.get_pixmap(dpi=250)
                img = Image.open(io.BytesIO(pix.tobytes('png')))
                full_text += pytesseract.image_to_string(img, lang='spa+eng') + '\n'
            doc.close()
            return full_text
    except Exception as e:
        return f'OCR_ERROR: {e}'
    return ''


def parse_invoice(text, filename, quarter):
    """Parse OCR text to extract invoice data."""
    tl = text.lower()
    rec = {
        'file': filename,
        'quarter': quarter,
        'type': 'OTRO',
        'supplier': '',
        'invoice_number': '',
        'date': '',
        'amount': 0,
        'description': '',
        'vehicle': '',
        'plate': '',
    }

    # Find Spanish plate pattern (4 digits + 3 letters)
    plates = re.findall(r'\b(\d{4}\s*[A-Z]{3})\b', text)
    if plates:
        rec['plate'] = plates[0].replace(' ', '')

    # Find all euro amounts
    amounts = find_all_euro_amounts(text)

    # ========== AUTOMOBILS ARIAL / taller ==========
    if 'automobils arial' in tl or 'arial' in tl and 'factura' in tl:
        rec['type'] = 'TALLER'
        rec['supplier'] = 'Automobils Arial S.L.U.'
        m = re.search(r'FACTURA:\s*(\S+)', text)
        if m: rec['invoice_number'] = m.group(1)
        m = re.search(r'DATA:\s*(\S+)', text)
        if m: rec['date'] = m.group(1)
        m = re.search(r'Marca:\s*(\w+)\s*Model:\s*(.+?)(?:\n|Xass)', text)
        if m: rec['vehicle'] = f'{m.group(1)} {m.group(2).strip()}'
        m = re.search(r'Matricula:\s*(\w+)', text)
        if m: rec['plate'] = m.group(1)
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = f"Taller {rec['vehicle']} {rec['plate']}"

    # ========== Cars Catalunya ==========
    elif 'cars catalunya' in tl:
        rec['type'] = 'TALLER'
        rec['supplier'] = 'Cars Catalunya 2021 S.L.'
        m = re.search(r'(T\d+-\d+)', text)
        if m: rec['invoice_number'] = m.group(1)
        m = re.search(r'MODELO\s*\n?\s*(.+?)[\n]', text)
        if not m: m = re.search(r'(?:DACIA|VW|SEAT|KIA|FORD|OPEL|PEUGEOT|RENAULT|MAZDA|VOLKSWAGEN)\s+\w+', text, re.I)
        if m: rec['vehicle'] = m.group(0).strip() if hasattr(m, 'group') else ''
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = f"Taller mecanico {rec['vehicle']} {rec['plate']}"

    # ========== MKTRES ==========
    elif 'mktres' in tl:
        rec['type'] = 'TALLER'
        rec['supplier'] = 'MKTRES Plancha y Pintura S.L.'
        m = re.search(r'Factura\s*:?\s*(\S+)', text)
        if m: rec['invoice_number'] = m.group(1)
        m = re.search(r'Matricula\s*:?\s*(\w+)', text, re.I)
        if m: rec['plate'] = m.group(1)
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = f"Reparacion chapa/pintura {rec['plate']}"

    # ========== Gestoria Ruppmann ==========
    elif 'ruppmann' in tl or 'gestoria' in tl and 'fiscal' in tl:
        rec['type'] = 'SERVICIOS'
        rec['supplier'] = 'Gestoria Ruppmann SL'
        m = re.search(r'FACTURA.*?(\d+\.\d+|\d+)', text)
        if m: rec['invoice_number'] = m.group(1)
        # Find date
        m = re.search(r'(?:MES DE|mes de)\s+(\w+)\s+(?:DEL|del)\s+(?:ANO|AÑO|ano)\s+(\d{4})', text, re.I)
        if m: rec['description'] = f"Gestoria fiscal {m.group(1)} {m.group(2)}"
        else: rec['description'] = 'Gestoria fiscal'
        if amounts: rec['amount'] = max(amounts)

    # ========== Gestoria Pradilla ==========
    elif 'pradilla' in tl:
        rec['type'] = 'SERVICIOS'
        rec['supplier'] = 'Gestoria Pradilla S.L.'
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = 'Gestoria/transferencias'

    # ========== Petrolis / gasolinera ==========
    elif 'petrolis' in tl or 'gasoil' in tl or 'gasolina' in tl or 's/p 95' in tl or 'carburant' in tl:
        rec['type'] = 'COMBUSTIBLE'
        rec['supplier'] = 'Gasolinera'
        m = re.search(r'FACTURA\s*(?:DATA)?\s*\n?\s*(\S+)', text)
        if m: rec['invoice_number'] = m.group(1)
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = 'Combustible'

    # ========== Autonomo ==========
    elif 'autonomo' in tl or 'autonomos' in tl or 'cotizacion' in tl:
        rec['type'] = 'AUTONOMO'
        rec['supplier'] = 'Seguridad Social'
        m = re.search(r'PERIODO.*?(\d{2}/\d{4})', text)
        if m: rec['description'] = f"Cuota autonomo {m.group(1)}"
        else: rec['description'] = 'Cuota autonomo'
        if amounts: rec['amount'] = max(amounts)

    # ========== Wallapop ==========
    elif 'wallapop' in tl:
        rec['type'] = 'PUBLICIDAD'
        rec['supplier'] = 'Wallapop SL'
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = 'Publicidad Wallapop'

    # ========== Adevinta / Coches.net ==========
    elif 'adevinta' in tl or 'coches.net' in tl or 'milanuncios' in tl:
        rec['type'] = 'PUBLICIDAD'
        rec['supplier'] = 'Adevinta Motor S.L.U.'
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = 'Publicidad Coches.net/Milanuncios'

    # ========== Luxury Wash ==========
    elif 'luxury' in tl and 'wash' in tl:
        rec['type'] = 'LIMPIEZA'
        rec['supplier'] = 'Luxury Wash El Prat S.L.'
        m = re.search(r'N.mero\s*\n?\s*(\d+)', text)
        if m: rec['invoice_number'] = m.group(1)
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = 'Limpieza vehiculos'

    # ========== Quidnei ==========
    elif 'quidnei' in tl:
        rec['type'] = 'LIMPIEZA'
        rec['supplier'] = 'Quidnei Rodrigues Sampaio'
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = 'Limpieza vehiculos'

    # ========== Norauto ==========
    elif 'norauto' in tl or 'nores' in tl:
        rec['type'] = 'RECAMBIOS'
        rec['supplier'] = 'Norauto'
        m = re.search(r'Factura\s*:?\s*(\S+)', text, re.I)
        if m: rec['invoice_number'] = m.group(1)
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = 'Recambios/mantenimiento Norauto'

    # ========== Eloy Ayala ==========
    elif 'eloy ayala' in tl or 'ayala' in tl:
        rec['type'] = 'RECAMBIOS'
        rec['supplier'] = 'Eloy Ayala Ruiz S.L.'
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = 'Recambios vehiculos'

    # ========== ITV ==========
    elif 'itv' in tl or 'inspecci' in tl:
        rec['type'] = 'SERVICIOS'
        rec['supplier'] = 'ITV'
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = f"ITV {rec['plate']}"

    # ========== Seguro ==========
    elif 'seguro' in tl or 'p.liza' in tl or 'mapfre' in tl or 'allianz' in tl or 'mutua' in tl:
        rec['type'] = 'SERVICIOS'
        rec['supplier'] = 'Seguro vehiculo'
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = f"Seguro {rec['plate']}"

    # ========== AUTO1 ==========
    elif 'auto1' in tl:
        if 'factura de venta' in tl or 'sales invoice' in tl:
            rec['type'] = 'COMPRA_VEHICULO'
            rec['supplier'] = 'AUTO1 European Cars B.V.'
        elif 'transport' in tl:
            rec['type'] = 'TRANSPORTE'
            rec['supplier'] = 'AUTO1 Group Operations SE'
        else:
            rec['type'] = 'GESTION_AUTO1'
            rec['supplier'] = 'AUTO1 Group Operations SE'
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = f"AUTO1 {rec['type'].lower()}"

    # ========== VW Renting ==========
    elif 'volkswagen renting' in tl:
        rec['type'] = 'COMPRA_VEHICULO'
        rec['supplier'] = 'Volkswagen Renting S.A.'
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = f"Compra vehiculo VW {rec['plate']}"

    # ========== Maria del Mar Garate ==========
    elif 'garate' in tl:
        rec['type'] = 'COMPRA_VEHICULO'
        rec['supplier'] = 'Maria del Mar Garate Gomez'
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = 'Compra vehiculo'

    # ========== CaixaBank ==========
    elif 'caixabank' in tl:
        rec['type'] = 'BANCO'
        rec['supplier'] = 'CaixaBank'
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = 'Cargo bancario'

    # ========== New Project SBD ==========
    elif 'new project' in tl:
        rec['type'] = 'SERVICIOS'
        rec['supplier'] = 'New Project SBD S.L.'
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = 'Servicios profesionales'

    # ========== Neumaticos ==========
    elif 'neum' in tl:
        rec['type'] = 'NEUMATICOS'
        rec['supplier'] = 'Proveedor neumaticos'
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = 'Neumaticos'

    # ========== Transferencia / DGT ==========
    elif 'transferencia' in tl and ('dgt' in tl or 'trafico' in tl):
        rec['type'] = 'SERVICIOS'
        rec['supplier'] = 'DGT/Trafico'
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = f"Transferencia vehiculo {rec['plate']}"

    # ========== Generic with FACTURA keyword ==========
    elif 'factura' in tl:
        rec['type'] = 'OTRO'
        # Try to find supplier from NIF line or header
        m = re.search(r'^(.+?)(?:\n|CIF|NIF|Tel)', text[:300])
        if m and len(m.group(1).strip()) > 3:
            rec['supplier'] = m.group(1).strip()[:60]
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = text[:100].replace('\n', ' ').strip()

    else:
        rec['type'] = 'OTRO'
        if amounts: rec['amount'] = max(amounts)
        rec['description'] = text[:100].replace('\n', ' ').strip()

    # Try to find invoice number if not set
    if not rec['invoice_number']:
        m = re.search(r'(?:factura|fra|fac|invoice)\s*[:#]?\s*(\S+)', text, re.I)
        if m: rec['invoice_number'] = m.group(1)

    # Try to find date if not set
    if not rec['date']:
        m = re.search(r'(\d{2}[/-]\d{2}[/-]\d{4})', text)
        if m: rec['date'] = m.group(1)
        else:
            m = re.search(r'(\d{2}[/-]\d{2}[/-]\d{2})\b', text)
            if m: rec['date'] = m.group(1)

    return rec


def main():
    print("Procesando imagenes con OCR...")
    print(f"Base: {base}")

    image_files = []
    for trimestre in sorted(os.listdir(base)):
        folder = os.path.join(base, trimestre)
        if not os.path.isdir(folder):
            continue

        t_lower = trimestre.lower()
        if '1' in t_lower: quarter = 'T1'
        elif '2' in t_lower: quarter = 'T2'
        elif '3' in t_lower: quarter = 'T3'
        elif '4' in t_lower: quarter = 'T4'
        else: quarter = '?'

        for f in sorted(os.listdir(folder)):
            path = os.path.join(folder, f)
            ext = f.lower().split('.')[-1]

            if ext in ('jpg', 'jpeg', 'png'):
                image_files.append((trimestre, f, path, quarter))
            elif ext == 'pdf':
                try:
                    doc = pymupdf.open(path)
                    text = doc[0].get_text().strip()
                    doc.close()
                    if not text:
                        image_files.append((trimestre, f, path, quarter))
                except:
                    image_files.append((trimestre, f, path, quarter))

    print(f"Imagenes a procesar: {len(image_files)}")

    results = []
    for i, (trimestre, f, path, quarter) in enumerate(image_files):
        print(f"  [{i+1}/{len(image_files)}] {trimestre}/{f}...", end='', flush=True)
        text = ocr_file(path)
        if text.startswith('OCR_ERROR'):
            print(f" ERROR: {text}")
            results.append({
                'file': f'{trimestre}/{f}',
                'quarter': quarter,
                'type': 'OCR_ERROR',
                'supplier': '',
                'invoice_number': '',
                'date': '',
                'amount': 0,
                'description': text,
                'vehicle': '',
                'plate': '',
            })
            continue

        rec = parse_invoice(text, f'{trimestre}/{f}', quarter)
        results.append(rec)
        print(f" [{rec['type']}] {rec['supplier'][:30]} | {rec['amount']:.2f} EUR")

    # Save results
    output_file = os.path.join(os.path.dirname(__file__), 'gastos_ocr_parsed.json')
    with open(output_file, 'w', encoding='utf-8') as fh:
        json.dump(results, fh, ensure_ascii=False, indent=2)

    # Summary
    from collections import Counter
    types = Counter(r['type'] for r in results)
    print(f'\n=== RESUMEN OCR ===')
    for t, c in types.most_common():
        total = sum(r['amount'] for r in results if r['type'] == t)
        print(f'  {t}: {c} registros, total: {total:,.2f} EUR')

    total = sum(r['amount'] for r in results)
    print(f'\nTOTAL OCR: {total:,.2f} EUR')
    print(f'Procesados: {len(results)}')
    print(f'\nGuardado en: {output_file}')


if __name__ == '__main__':
    main()
