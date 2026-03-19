import pymupdf
import json
import re
import os

base = r'C:\Users\Usuario\Desktop\proyectos\cars_control\docs_legacy\GASTOS\GASTOS DE LOS 4 TRIMESTRES 2025'


def parse_euro_amount(text_fragment):
    """Parse a euro amount like '6.130,00' or '8264,46' to float."""
    # Remove dots (thousands separator), replace comma with dot (decimal)
    cleaned = text_fragment.strip().replace('.', '').replace(',', '.')
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def find_all_euro_amounts(text):
    """Find all amounts followed by euro sign."""
    # Match amounts like 6.130,00 € or 8.264,46 €
    matches = re.findall(r'([\d]+(?:\.[\d]{3})*(?:,[\d]{2})?)\s*(?:\x80|€)', text)
    return [parse_euro_amount(m) for m in matches if parse_euro_amount(m) > 0]


results = []

for trimestre in sorted(os.listdir(base)):
    folder = os.path.join(base, trimestre)
    if not os.path.isdir(folder):
        continue

    t_lower = trimestre.lower()
    if '1' in t_lower:
        quarter = 'T1'
    elif '2' in t_lower:
        quarter = 'T2'
    elif '3' in t_lower:
        quarter = 'T3'
    elif '4' in t_lower:
        quarter = 'T4'
    else:
        quarter = '?'

    for f in sorted(os.listdir(folder)):
        path = os.path.join(folder, f)
        ext = f.lower().split('.')[-1]
        text = ''
        if ext == 'pdf':
            try:
                doc = pymupdf.open(path)
                for page in doc:
                    text += page.get_text()
                doc.close()
            except:
                pass

        if not text.strip():
            results.append({
                'file': f'{trimestre}/{f}',
                'quarter': quarter,
                'type': 'IMAGE_NO_TEXT',
                'supplier': '',
                'invoice_number': '',
                'date': '',
                'amount': 0,
                'description': f'Imagen sin texto - {f}',
                'vehicle': '',
                'plate': '',
                'path': path,
            })
            continue

        tl = text.lower()
        rec = {
            'file': f'{trimestre}/{f}',
            'quarter': quarter,
            'type': 'GASTO',
            'supplier': '',
            'invoice_number': '',
            'date': '',
            'amount': 0,
            'description': '',
            'vehicle': '',
            'plate': '',
            'path': path,
        }

        # ========== AUTO1 - Vehicle purchase ==========
        if 'auto1' in tl and ('factura de venta' in tl or 'second-hand car sales invoice' in tl):
            rec['type'] = 'COMPRA_VEHICULO'
            rec['supplier'] = 'AUTO1 European Cars B.V.'

            # Invoice number: "Núm. Factura Invoice No\n90072501001178"
            m = re.search(r'Factura Invoice No\s*\n\s*(\d+)', text)
            if m:
                rec['invoice_number'] = m.group(1)

            # Date: "Fecha / Date\n07.01.2025"
            m = re.search(r'Fecha / Date\s*\n\s*(\d{2}\.\d{2}\.\d{4})', text)
            if m:
                parts = m.group(1).split('.')
                rec['date'] = f'{parts[2]}-{parts[1]}-{parts[0]}'

            # Amount: line with M and amount like "6.130,00"
            m = re.search(r'\bM\s*\n?\s*([\d]+(?:\.[\d]{3})*(?:,[\d]{2}))', text)
            if m:
                rec['amount'] = parse_euro_amount(m.group(1))
            else:
                # Fallback: Total neto
                m = re.search(r'Total neto.*?Total Net.*?\n\s*([\d.,]+)', text)
                if m:
                    rec['amount'] = parse_euro_amount(m.group(1))

            # Vehicle: "Marca / Modelo:\nBrand / Model\nDacia / Sandero ..."
            m = re.search(r'Brand / Model\s*\n\s*(.+)', text)
            if m:
                rec['vehicle'] = m.group(1).strip()

            # Plate: "Vin / License Plate\nUU15SDA1C55026465 / 2863JNH"
            m = re.search(r'License Plate\s*\n\s*\S+\s*/\s*(\w+)', text)
            if m:
                rec['plate'] = m.group(1).strip()

            rec['description'] = f"Compra vehiculo {rec['vehicle']} ({rec['plate']})"

        # ========== AUTO1 - Services (handling, auction, transport) ==========
        elif 'auto1' in tl and ('handling' in tl or 'auction' in tl or 'transport' in tl):
            if 'transport' in tl:
                rec['type'] = 'TRANSPORTE'
                rec['description'] = 'Transporte vehiculo AUTO1'
            else:
                rec['type'] = 'GESTION_AUTO1'
                rec['description'] = 'Gastos gestion AUTO1 (handling + auction)'
            rec['supplier'] = 'AUTO1 Group Operations SE'

            m = re.search(r'Invoice No\s*\n\s*(\d+)', text)
            if m:
                rec['invoice_number'] = m.group(1)

            m = re.search(r'(?:Datum|Date)\s*\n\s*(\d{2}\.\d{2}\.\d{4})', text)
            if m:
                parts = m.group(1).split('.')
                rec['date'] = f'{parts[2]}-{parts[1]}-{parts[0]}'

            m = re.search(r'Total EUR Total EUR\s*\n\s*([\d.,]+)', text)
            if m:
                rec['amount'] = parse_euro_amount(m.group(1))

            m = re.search(r'VIN\s*\n\s*(\w{17})', text)
            if m:
                rec['plate'] = m.group(1)

            m = re.search(r'Brand / Model\s*\n\s*(.+)', text)
            if m:
                rec['vehicle'] = m.group(1).strip()

        # ========== MKTRES - body shop ==========
        elif 'mktres' in tl:
            rec['type'] = 'TALLER'
            rec['supplier'] = 'MKTRES Plancha y Pintura S.L.'

            m = re.search(r'de Factura\s*:\s*\n\s*(\S+)', text)
            if m:
                rec['invoice_number'] = m.group(1)

            m = re.search(r'Fecha\s*:\s*\n\s*(\d{2}/\d{2}/\d{4})', text)
            if m:
                parts = m.group(1).split('/')
                rec['date'] = f'{parts[2]}-{parts[1]}-{parts[0]}'

            m = re.search(r'Matricula\s*:\s*(\w+)', text)
            if m:
                rec['plate'] = m.group(1)

            # Vehicle brand/model from O.R. line
            m = re.search(r'O\.R\..*?\d+\s+(\w+)\s+(\w+)', text)
            if m:
                rec['vehicle'] = f'{m.group(1)} {m.group(2)}'

            amounts = find_all_euro_amounts(text)
            if amounts:
                rec['amount'] = max(amounts)

            rec['description'] = f"Reparacion chapa/pintura {rec['vehicle']} {rec['plate']}"

        # ========== VW Renting - vehicle purchase ==========
        elif 'volkswagen renting' in tl:
            rec['type'] = 'COMPRA_VEHICULO'
            rec['supplier'] = 'Volkswagen Renting S.A.'

            m = re.search(r'Factura\s*\n\s*:\s*(\S+)', text)
            if m:
                rec['invoice_number'] = m.group(1)

            m = re.search(r'Fecha\s*\n\s*:\s*(\d{2}-\d{2}-\d{4})', text)
            if m:
                parts = m.group(1).split('-')
                rec['date'] = f'{parts[2]}-{parts[1]}-{parts[0]}'

            m = re.search(r'Matr.cula\s*\n\s*:\s*(\w+)', text)
            if m:
                rec['plate'] = m.group(1)

            m = re.search(r'Modelo\s*\n\s*:\s*(.+)', text)
            if m:
                rec['vehicle'] = m.group(1).strip()

            # TOTAL FACTURA amount
            m = re.search(r'TOTAL FACTURA\s*\n?\s*:\s*\n?\s*([\d.,]+)', text)
            if m:
                rec['amount'] = parse_euro_amount(m.group(1))
            else:
                amounts = find_all_euro_amounts(text)
                if amounts:
                    rec['amount'] = max(amounts)

            rec['description'] = f"Compra vehiculo {rec['vehicle']} ({rec['plate']})"

        # ========== Maria del Mar Garate - vehicle dealer ==========
        elif 'garate' in tl and 'veh' in tl:
            rec['type'] = 'COMPRA_VEHICULO'
            rec['supplier'] = 'Maria del Mar Garate Gomez'

            m = re.search(r'FACTURA:\s*\n\s*(\S+)', text)
            if m:
                rec['invoice_number'] = m.group(1)

            m = re.search(r'FECHA:\s*\n\s*(.+)', text)
            if m:
                rec['date'] = m.group(1).strip()

            # Vehicle info from structured fields
            marca = re.search(r'Marca:\s*\n.*?\n\s*(.+?)(?:\n|$)', text)
            modelo = re.search(r'Modelo:\s*\n.*?\n\s*(.+?)(?:\n|$)', text)
            matricula = re.search(r'Matr.cula:\s*\n.*?\n\s*(.+?)(?:\n|$)', text)

            # Actually the format has fields one after another
            # Try to find brand and plate from bottom of invoice
            m_marca = re.search(r'(?:VOLKSWAGEN|DACIA|SEAT|KIA|FORD|OPEL|PEUGEOT|RENAULT|MAZDA|TOYOTA|BMW|AUDI|MERCEDES)', text, re.I)
            if m_marca:
                rec['vehicle'] = m_marca.group(0)

            # Find plate (Spanish format: 4 digits + 3 letters)
            m_plate = re.search(r'\b(\d{4}\s*[A-Z]{3})\b', text)
            if m_plate:
                rec['plate'] = m_plate.group(1).replace(' ', '')

            # Total IVA Incluido amount
            amounts = find_all_euro_amounts(text)
            if amounts:
                rec['amount'] = max(amounts)

            rec['description'] = f"Compra vehiculo {rec['vehicle']} ({rec['plate']})"

        # ========== CaixaBank - check if autonomo or other ==========
        elif 'caixabank' in tl:
            if 'autonomo' in tl or 'autonomos' in tl:
                rec['type'] = 'AUTONOMO'
                rec['supplier'] = 'Seguridad Social (via CaixaBank)'
                m = re.search(r'PERIODO LIQUIDACION:\s*(\S+)', text)
                if m:
                    rec['description'] = f"Cuota autonomo {m.group(1)}"
                else:
                    rec['description'] = 'Cuota autonomo'
                m = re.search(r'([\d.,]+)\s*\n\s*[\d.,]+\s*\n', text)
                if m:
                    rec['amount'] = parse_euro_amount(m.group(1))
            else:
                rec['type'] = 'BANCO'
                rec['supplier'] = 'CaixaBank'
                rec['description'] = 'Cargo bancario'

        # ========== Luxury Wash ==========
        elif 'luxury wash' in tl:
            rec['type'] = 'LIMPIEZA'
            rec['supplier'] = 'Luxury Wash El Prat S.L.'

            m = re.search(r'N.mero\s*\n\s*(\d+)', text)
            if m:
                rec['invoice_number'] = m.group(1)

            m = re.search(r'Fecha\s*\n\s*([\d-]+)', text)
            if m:
                rec['date'] = m.group(1)

            amounts = find_all_euro_amounts(text)
            if amounts:
                rec['amount'] = max(amounts)

            # Try to get vehicle from description
            m = re.search(r'(?:DACIA|VW|SEAT|KIA|FORD|OPEL|PEUGEOT|RENAULT|MAZDA|CADDY|POLO)\s+[\w\s]*\d+\s*\w+', text, re.I)
            if m:
                rec['description'] = f"Limpieza: {m.group(0).strip()}"
            else:
                rec['description'] = 'Limpieza vehiculos'

        # ========== Wallapop ==========
        elif 'wallapop' in tl:
            rec['type'] = 'PUBLICIDAD'
            rec['supplier'] = 'Wallapop SL'
            m = re.search(r'Invoice #.*?\n.*?\n\s*(\S+)', text)
            if m:
                rec['invoice_number'] = m.group(1)
            m = re.search(r'Date\s*\n.*?\n\s*(\S+)', text)
            if m:
                rec['date'] = m.group(1)
            amounts = find_all_euro_amounts(text)
            if amounts:
                rec['amount'] = max(amounts)
            rec['description'] = 'Publicidad Wallapop'

        # ========== Adevinta (Coches.net/Milanuncios) ==========
        elif 'adevinta' in tl:
            rec['type'] = 'PUBLICIDAD'
            rec['supplier'] = 'Adevinta Motor S.L.U.'
            m = re.search(r'Factura\s*\n\s*(\w+)', text)
            if m:
                rec['invoice_number'] = m.group(1)
            m = re.search(r'Fecha:\s*\n?\s*(\S+)', text)
            if m:
                rec['date'] = m.group(1)
            amounts = find_all_euro_amounts(text)
            if amounts:
                rec['amount'] = max(amounts)
            rec['description'] = 'Publicidad Coches.net/Milanuncios'

        # ========== Gas station / combustible ==========
        elif any(w in tl for w in ['gasoil', 'gasolina', 's/p 95']):
            rec['type'] = 'COMBUSTIBLE'
            rec['supplier'] = 'Gasolinera'
            m = re.search(r'DATA\s*\n\s*(\S+)', text)
            if m:
                rec['invoice_number'] = m.group(1)
            amounts = find_all_euro_amounts(text)
            if amounts:
                rec['amount'] = max(amounts)
            rec['description'] = 'Combustible'

        # ========== Norauto ==========
        elif 'nores' in tl and 'factura' in tl:
            rec['type'] = 'RECAMBIOS'
            rec['supplier'] = 'Norauto'
            m = re.search(r'N.Factura\s*:\s*(\S+)', text)
            if m:
                rec['invoice_number'] = m.group(1)
            m = re.search(r'Fecha\s*(?:venta|factura):\s*(\S+)', text)
            if m:
                rec['date'] = m.group(1)
            amounts = find_all_euro_amounts(text)
            if amounts:
                rec['amount'] = max(amounts)
            rec['description'] = 'Recambios/mantenimiento Norauto'

        # ========== Cars Catalunya (taller) ==========
        elif 'cars catalunya' in tl:
            rec['type'] = 'TALLER'
            rec['supplier'] = 'Cars Catalunya 2021 S.L.'
            m = re.search(r'(T\d+-\d+)', text)
            if m:
                rec['invoice_number'] = m.group(1)
            m = re.search(r'FECHA\s*\n\s*(.+?)[\n]', text)
            if m:
                rec['date'] = m.group(1).strip()
            m = re.search(r'MODELO\s*\n\s*(.+?)[\n]', text)
            if m:
                rec['vehicle'] = m.group(1).strip()
            m = re.search(r'MATRICULA\s*\n\s*(.+?)[\n]', text)
            if m:
                rec['plate'] = m.group(1).strip()
            amounts = find_all_euro_amounts(text)
            if amounts:
                rec['amount'] = max(amounts)
            rec['description'] = f"Taller mecanico {rec['vehicle']} {rec['plate']}"

        # ========== Eloy Ayala (recambios) ==========
        elif 'eloy ayala' in tl:
            rec['type'] = 'RECAMBIOS'
            rec['supplier'] = 'Eloy Ayala Ruiz S.L.'
            amounts = find_all_euro_amounts(text)
            if amounts:
                rec['amount'] = max(amounts)
            rec['description'] = 'Recambios vehiculos'

        # ========== New Project SBD ==========
        elif 'new project' in tl:
            rec['type'] = 'SERVICIOS'
            rec['supplier'] = 'New Project SBD S.L.'
            amounts = find_all_euro_amounts(text)
            if amounts:
                rec['amount'] = max(amounts)
            rec['description'] = 'Servicios profesionales'

        # ========== Neumaticos ==========
        elif 'neum' in tl and 'factura' in tl:
            rec['type'] = 'NEUMATICOS'
            rec['supplier'] = 'Proveedor neumaticos'
            m = re.search(r'Factura:\s*(\S+)', text)
            if m:
                rec['invoice_number'] = m.group(1)
            m = re.search(r'Fecha:\s*\n\s*(.+?)[\n]', text)
            if m:
                rec['date'] = m.group(1).strip()
            amounts = find_all_euro_amounts(text)
            if amounts:
                rec['amount'] = max(amounts)
            rec['description'] = 'Neumaticos ocasion'

        # ========== Autonomo receipt (from filename) ==========
        elif 'autonomo' in f.lower():
            rec['type'] = 'AUTONOMO'
            rec['supplier'] = 'Seguridad Social'
            rec['description'] = f'Cuota autonomo - {f}'

        # ========== Software ==========
        elif 'tulicencias' in tl or 'microsoft' in tl:
            rec['type'] = 'SOFTWARE'
            rec['supplier'] = 'TuLicencias'
            amounts = find_all_euro_amounts(text)
            if amounts:
                rec['amount'] = max(amounts)
            rec['description'] = 'Licencia software'

        # ========== Quidnei (limpieza, NOT car purchase) ==========
        elif 'quidnei' in tl:
            rec['type'] = 'LIMPIEZA'
            rec['supplier'] = 'Quidnei Rodrigues Sampaio'
            m = re.search(r'FACTURA\s+(\S+)', text)
            if m:
                rec['invoice_number'] = m.group(1)
            m = re.search(r'Fecha\s*\n\s*(.+?)[\n]', text)
            if not m:
                m = re.search(r'(\d{2}/\d{2}/\d{4})', text)
            if m:
                rec['date'] = m.group(1).strip()
            amounts = find_all_euro_amounts(text)
            if amounts:
                rec['amount'] = max(amounts)
            rec['description'] = 'Limpieza vehiculos'

        else:
            rec['type'] = 'OTRO'
            rec['description'] = text[:200].replace('\n', ' ').strip()

        results.append(rec)

with open(r'C:\Users\Usuario\Desktop\proyectos\cars_control\gastos_parsed.json', 'w', encoding='utf-8') as fh:
    json.dump(results, fh, ensure_ascii=False, indent=2)

# Summary
from collections import Counter

types = Counter(r['type'] for r in results)
print('=== RESUMEN POR TIPO ===')
for t, c in types.most_common():
    total = sum(r['amount'] for r in results if r['type'] == t)
    print(f'  {t}: {c} facturas, total: {total:,.2f} EUR')

total_amount = sum(r['amount'] for r in results)
print(f'\nTOTAL GASTOS EXTRAIDOS: {total_amount:,.2f} EUR')
print(f'TOTAL: {len(results)} registros')
print(f'Con datos extraidos: {sum(1 for r in results if r["type"] != "IMAGE_NO_TEXT")}')
print(f'Imagenes sin texto: {sum(1 for r in results if r["type"] == "IMAGE_NO_TEXT")}')

print('\n=== COMPRAS DE VEHICULOS ===')
for r in results:
    if r['type'] == 'COMPRA_VEHICULO':
        print(f"  {r['supplier']} | Fac: {r['invoice_number']} | {r['date']} | {r['amount']:,.2f} EUR | {r['vehicle']} ({r['plate']})")

print('\n=== TODOS LOS GASTOS CON TEXTO (no imagenes) ===')
for r in results:
    if r['type'] != 'IMAGE_NO_TEXT':
        print(f"  [{r['type']}] {r['supplier']} | {r['invoice_number']} | {r['date']} | {r['amount']:,.2f} EUR | {r['description'][:60]}")
