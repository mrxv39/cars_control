# -*- coding: utf-8 -*-
"""Extract client and vehicle data from FACTURA VENTA PDFs and import into DB."""

import pymupdf, os, re, json, sys, sqlite3, openpyxl, datetime

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DB_PATH = os.path.expandvars(r'%APPDATA%\com.codinacars.carscontrol\data\app.db')

BRANDS = {'OPEL', 'SEAT', 'VOLKSWAGEN', 'RENAULT', 'BMW', 'NISSAN', 'CUPRA', 'FORD',
          'CITROEN', 'DACIA', 'FIAT', 'VOLVO', 'SUZUKI', 'AUDI', 'KIA', 'SKODA',
          'MAZDA', 'PEUGEOT', 'CHEVROLET', 'ABARTH', 'HYUNDAI', 'TOYOTA', 'MERCEDES',
          'VW', 'MINI'}

NOT_NAMES = {'FECHA', 'FACTURA', 'CANTIDAD', 'PRECIO', 'IMPORTE', 'DESCRIPCION',
             'BARCELONA', 'MADRID', 'GIRONA', 'TARRAGONA', 'LLEIDA', 'RICARD CODINA',
             'MOLINS DE REI', 'TOTAL', 'BASE IMP.'}


def is_name(line):
    """Check if a line looks like a person/company name."""
    if not line or len(line) < 5:
        return False
    up = line.upper().strip()
    if up in NOT_NAMES:
        return False
    skip_sub = ['FECHA', 'FACTURA', 'CIF', 'CANTIDAD', 'PRECIO', 'IVA', 'IMPORTE',
                'BASE IMP', 'TOTAL', 'I.V.A', 'Marca', 'Modelo', 'Version', 'Chasis',
                'cula', 'Matricula', 'Kilometros', 'DESCRIPCION', 'gimen', 'Especial',
                'Bienes', 'C/ ', 'C/', 'AV.', 'AV ', 'AVDA', 'CALLE', 'PASEO',
                'PL.', 'PLAZA', 'RAMBLA', 'CARRER', 'VENTA', 'VEHICULO', 'OCASI',
                'LOCAL', 'REGIMEN', 'CP ', 'BASTIDOR', 'TSI', '21%',
                'CODINA', 'SANT ', 'MOLINS']
    if any(p in line for p in skip_sub):
        return False
    if re.match(r'^[\d.,\s\u20ac]+$', line):
        return False
    if re.match(r'^\d', line):
        return False
    if line.startswith(('08', '09', '17', '25', '43')):
        return False
    # Reject if it's a car brand or model
    if up in BRANDS:
        return False
    models = {'QASHQAI', 'FORMENTOR', 'CORSA', 'MODUS', 'POLO', 'SCENIC', 'FOCUS',
              'PUMA', 'ANTARA', 'DUSTER', 'SANDERO', 'LODGY', 'IBIZA', 'LEON',
              'XTRAIL', 'X-TRAIL', 'CLIO', 'CADDY', 'DOKKER', 'RIO', 'KAMIQ',
              'GOLF', 'CAPTIVA', 'SX4', 'A3', 'SERIE 1', 'SERIE 3', 'V50',
              'XSARA PICASSO', 'C3', 'LEON ST', 'CUPRA LEON ST', 'MEGANE SCENIC',
              'CADDY CARGO', 'CADDY FURGON', 'CADDY FURGON CERRADO',
              'FORMENTOR DSG', 'LOGAN MCV STEPWAY', 'SANDERO STEPWAY',
              'POLO R LINE', '500'}
    if up in models or up.replace(' ', '') in {m.replace(' ', '') for m in models}:
        return False
    # SURNAME, FIRSTNAME
    if ',' in line:
        parts = [p.strip() for p in line.split(',') if p.strip()]
        if all(re.match(r'^[A-Za-z\u00C0-\u024F\s.]+$', p) for p in parts):
            return True
    # FIRSTNAME LASTNAME
    if re.match(r'^[A-Z\u00C0-\u024F][A-Za-z\u00C0-\u024F\s.]+$', line) and ' ' in line:
        return True
    # Company
    if re.match(r'^[A-Z][A-Z\s,]+$', line) and len(line) > 4:
        words = line.split()
        if not all(w in BRANDS for w in words):
            return True
    return False


def extract_invoice_data(pdf_path):
    try:
        doc = pymupdf.open(pdf_path)
        text = doc[0].get_text()
        doc.close()
    except Exception:
        return None

    lines = [l.strip() for l in text.split('\n') if l.strip()]
    data = {'client_name': None, 'client_dni': None, 'invoice_number': None,
            'date': None, 'marca': None, 'modelo': None, 'matricula': None,
            'km': None, 'price': None}

    for i, line in enumerate(lines):
        # Invoice number
        if 'FACTURA:' in line.upper() and i + 1 < len(lines):
            rest = line.split(':')[-1].strip()
            if rest and rest[0] in 'Vv':
                data['invoice_number'] = rest
            elif lines[i+1][0:1] in 'Vv':
                data['invoice_number'] = lines[i+1].strip()

        # Date
        if 'FECHA:' in line and not data['date']:
            rest = line.split('FECHA:')[-1].strip()
            if rest and rest[0].isdigit():
                data['date'] = rest
            elif i + 1 < len(lines) and lines[i+1][0:1].isdigit():
                data['date'] = lines[i+1].strip()

        # Client DNI
        if 'CIF/DNI' in line.upper():
            rest = line.split(':')[-1].strip()
            if rest and rest != '47.788.643-W':
                data['client_dni'] = rest
            elif i + 1 < len(lines) and lines[i+1].strip() != '47.788.643-W':
                c = lines[i+1].strip()
                if re.match(r'^[\d.]+[-]?[A-Za-z]$', c) or re.match(r'^\d{8}[A-Z]$', c) or re.match(r'^[A-Z]\d{7}[A-Z]$', c):
                    data['client_dni'] = c

        # Vehicle data - NEW FORMAT: "Marca: SEAT" on same line
        if line.startswith('Marca:') and ':' in line:
            val = line.split(':', 1)[1].strip()
            if val:
                data['marca'] = val.upper()
        if line.startswith('Modelo:') and ':' in line:
            val = line.split(':', 1)[1].strip()
            if val:
                data['modelo'] = val
        if ('cula:' in line or 'Matricula:' in line) and ':' in line:
            val = line.split(':', 1)[1].strip()
            if val and (re.match(r'^\d{4}[A-Z]{3}$', val) or re.match(r'^[A-Z]\d{4}[A-Z]{2}$', val)):
                data['matricula'] = val
        if 'ilometros:' in line.lower():
            val = line.split(':', 1)[1].strip()
            km_m = re.search(r'([\d.]+)', val)
            if km_m:
                ks = km_m.group(1).replace('.', '')
                if ks.isdigit() and int(ks) > 50:
                    data['km'] = ks

    # Vehicle data - OLD FORMAT: values after DESCRIPCION on separate lines
    if not data['marca']:
        desc_idx = None
        for i, line in enumerate(lines):
            if line == 'DESCRIPCION':
                desc_idx = i
                break
        if desc_idx:
            vals = []
            for j in range(desc_idx + 1, min(len(lines), desc_idx + 12)):
                l = lines[j]
                if 'Total' in l or 'gimen' in l:
                    break
                vals.append(l)
            for val in vals:
                if not data['marca'] and val.upper() in BRANDS:
                    data['marca'] = val.upper()
                    continue
                if not data['matricula'] and (re.match(r'^\d{4}[A-Z]{3}$', val) or re.match(r'^[A-Z]\d{4}[A-Z]{2}$', val)):
                    data['matricula'] = val
                    continue
                if data['marca'] and not data['modelo'] and not re.match(r'^\d', val) and len(val) > 1 and val != 'FACTURA':
                    # Reject bastidor-like strings
                    if not re.match(r'^[A-Z0-9]{17}$', val):
                        data['modelo'] = val
                        continue

    # Km - old format (separate line)
    if not data['km']:
        for i, line in enumerate(lines):
            if 'ilometros' in line.lower() and ':' not in line:
                for j in range(i, min(len(lines), i + 3)):
                    km_m = re.search(r'([\d.]+)', lines[j])
                    if km_m:
                        ks = km_m.group(1).replace('.', '')
                        if ks.isdigit() and int(ks) > 50:
                            data['km'] = ks
                            break
                break

    # Price from Total I.V.A
    for i, line in enumerate(lines):
        if 'Total I.V.A' in line:
            pm = re.search(r'([\d.]+,\d{2})', line)
            if pm:
                data['price'] = float(pm.group(1).replace('.', '').replace(',', '.'))
            if not data['price']:
                for j in range(max(0, i-3), i):
                    pm = re.search(r'([\d.]+,\d{2})', lines[j])
                    if pm:
                        data['price'] = float(pm.group(1).replace('.', '').replace(',', '.'))
            break

    # Client name:
    # NEW FORMAT (2025+): name is BEFORE "FACTURA" keyword, after the price/vehicle block
    # OLD FORMAT (2024-): name is between "FACTURA" and "DESCRIPCION"
    # Strategy: try both, prefer the one that gives a real name

    # Try 1: Look BEFORE "FACTURA" keyword (scanning backwards from it)
    factura_idx = None
    for i, line in enumerate(lines):
        if line == 'FACTURA':
            factura_idx = i
            break

    if factura_idx:
        # Search backwards from FACTURA for name
        for i in range(factura_idx - 1, max(0, factura_idx - 6), -1):
            if is_name(lines[i]):
                data['client_name'] = lines[i].strip()
                break

        # Try 2: Look AFTER "FACTURA" + "DESCRIPCION" for old format
        if not data['client_name']:
            for i in range(factura_idx + 1, len(lines)):
                if is_name(lines[i]):
                    data['client_name'] = lines[i].strip()
                    break

    # Try 3: between seller DNI and FECHA
    if not data['client_name']:
        seller_found = False
        for i, line in enumerate(lines):
            if '47.788.643-W' in line:
                seller_found = True
                continue
            if not seller_found:
                continue
            if 'FECHA' in line:
                break
            if is_name(line):
                data['client_name'] = line.strip()
                break

    return data


def parse_date(date_str):
    if not date_str:
        return None
    m = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', date_str)
    if m:
        return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    return date_str


# ── SCAN ──
bases = [
    (2023, r'C:/Users/Usuario/Desktop/proyectos/cars_control/docs_legacy/varios codinacars/VENTAS 2023'),
    (2024, r'C:/Users/Usuario/Desktop/proyectos/cars_control/docs_legacy/varios codinacars/VENTAS 2024'),
    (2025, r'C:/Users/Usuario/Desktop/proyectos/cars_control/docs_legacy/varios codinacars/VENTAS 2025'),
    (2026, r'C:/Users/Usuario/Desktop/proyectos/cars_control/docs_legacy/CODINACARS PC/VENTAS 2026'),
]

all_invoices = []
for year, base in bases:
    if not os.path.exists(base):
        continue
    for month in sorted(os.listdir(base)):
        mp = os.path.join(base, month)
        if not os.path.isdir(mp):
            continue
        for veh in sorted(os.listdir(mp)):
            vp = os.path.join(mp, veh)
            if not os.path.isdir(vp):
                continue
            candidates = [f for f in os.listdir(vp) if 'factura' in f.lower() and 'venta' in f.lower() and f.lower().endswith('.pdf')]
            pdf_path = None
            for c in candidates:
                cl = c.lower()
                if 'mar' not in cl and 'compra' not in cl:
                    pdf_path = os.path.join(vp, c)
                    break
            if not pdf_path:
                for c in candidates:
                    if 'cliente final' in c.lower():
                        pdf_path = os.path.join(vp, c)
                        break
            if not pdf_path and candidates:
                pdf_path = os.path.join(vp, candidates[0])
            if pdf_path:
                data = extract_invoice_data(pdf_path)
                if data and data.get('invoice_number'):
                    if data.get('client_name') and 'CODINA' in (data['client_name'] or '').upper():
                        continue
                    data['folder_path'] = vp
                    data['year'] = year
                    all_invoices.append(data)

# ── ENRICH WITH EXCEL ──
excel_files = [
    r'C:/Users/Usuario/Desktop/proyectos/cars_control/docs_legacy/varios codinacars/VARIOS, 23,24,25/varios 2023/LISTADO FACTURAS VENTA 2023 RICHI.xlsx',
    r'C:/Users/Usuario/Desktop/proyectos/cars_control/docs_legacy/varios codinacars/VARIOS, 23,24,25/varios 2024/2024...varios/LISTADO FACTURAS VENTA 2024 RICHI.xlsx',
    r'C:/Users/Usuario/Desktop/proyectos/cars_control/docs_legacy/varios codinacars/VARIOS, 23,24,25/varios 2025/LISTADO FACTURAS VENTA 2025 RICHI.xlsx',
]
excel_data = {}
for path in excel_files:
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb['Hoja1']
    for row in ws.iter_rows(min_row=2, max_row=ws.max_row, values_only=True):
        factura, fecha, vehiculo, matricula, base_compra, b_imponible, beneficio = row[:7]
        if factura and vehiculo and fecha:
            excel_data[str(factura).strip()] = {
                'vehicle_excel': str(vehiculo).strip(),
                'plate_excel': str(matricula).strip() if matricula else None,
                'purchase_price': float(base_compra) if base_compra else None,
                'profit': float(beneficio) if beneficio else None,
            }

for inv in all_invoices:
    inv_key = inv['invoice_number'].replace('/', '_').replace('-', '_')
    ed = excel_data.get(inv_key, {})
    inv['purchase_price'] = ed.get('purchase_price')
    inv['profit'] = ed.get('profit')
    if not inv['marca'] and ed.get('vehicle_excel'):
        parts = ed['vehicle_excel'].split()
        inv['marca'] = parts[0]
        inv['modelo'] = ' '.join(parts[1:]) if len(parts) > 1 else None
    if not inv['matricula'] and ed.get('plate_excel'):
        inv['matricula'] = ed['plate_excel']

# ── PRINT ──
print(f"{'INV':<10} {'DATE':<12} {'VEHICLE':<30} {'PLATE':<10} {'CLIENT':<40} {'DNI':<15} {'PRICE':>10} {'BEN':>8}")
print("-" * 140)
for d in sorted(all_invoices, key=lambda x: parse_date(x.get('date', '')) or ''):
    v = f"{d['marca'] or '?'} {d['modelo'] or '?'}".strip()
    pr = f"{d['profit']:.0f}" if d.get('profit') else '-'
    pc = f"{d['price']:.0f}" if d.get('price') else '-'
    print(f"{d['invoice_number']:<10} {d['date'] or '?':<12} {v:<30} {d['matricula'] or '?':<10} {d['client_name'] or '?':<40} {d['client_dni'] or '?':<15} {pc:>10} {pr:>8}")

wc = sum(1 for d in all_invoices if d.get('client_name'))
wv = sum(1 for d in all_invoices if d.get('marca'))
print(f"\n=== TOTAL: {len(all_invoices)} invoices | {wc} with client | {wv} with vehicle ===")

# ── IMPORT ──
print("\n--- IMPORTING ---")
conn = sqlite3.connect(DB_PATH)
conn.execute("PRAGMA foreign_keys = OFF")
conn.execute("DELETE FROM sales_records")
conn.execute("DELETE FROM clients")
conn.execute("DELETE FROM vehicles WHERE estado = 'vendido'")
conn.commit()

clients_map = {}
vehicle_paths = set()

for inv in sorted(all_invoices, key=lambda x: parse_date(x.get('date', '')) or ''):
    date_iso = parse_date(inv['date'])
    if not date_iso:
        continue
    vname = f"{inv['marca'] or '?'} {inv['modelo'] or '?'}".strip()
    plate = inv.get('matricula') or ''
    folder = inv.get('folder_path', f"legacy/{inv['year']}/{plate or vname}")

    if folder not in vehicle_paths:
        conn.execute("INSERT OR IGNORE INTO vehicles (folder_path, name, precio_compra, precio_venta, estado) VALUES (?, ?, ?, ?, 'vendido')",
                     (folder, vname, inv.get('purchase_price'), inv.get('price')))
        vehicle_paths.add(folder)

    client_id = None
    cname = inv.get('client_name')
    cdni = inv.get('client_dni')
    if cname:
        key = cname.upper()
        if key not in clients_map:
            cur = conn.execute("INSERT INTO clients (name, phone, email, dni, notes, vehicle_folder_path) VALUES (?, '', '', ?, ?, ?)",
                              (cname, cdni or '', f"Factura {inv['invoice_number']}", folder))
            clients_map[key] = cur.lastrowid
        client_id = clients_map[key]

    notes = []
    if inv.get('invoice_number'): notes.append(f"Factura: {inv['invoice_number']}")
    if inv.get('profit') and inv['profit'] > 0: notes.append(f"Beneficio: {inv['profit']:.0f} EUR")
    if inv.get('purchase_price') and inv['purchase_price'] > 0: notes.append(f"Compra: {inv['purchase_price']:.0f} EUR")
    if plate: notes.append(f"Matricula: {plate}")
    if inv.get('km'): notes.append(f"Km: {inv['km']}")

    conn.execute("INSERT INTO sales_records (vehicle_folder_path, client_id, lead_id, price_final, date, notes) VALUES (?, ?, NULL, ?, ?, ?)",
                 (folder, client_id, inv.get('price') or 0, date_iso + 'T12:00:00Z', ' | '.join(notes)))

conn.commit()
sr = conn.execute("SELECT COUNT(*) FROM sales_records").fetchone()[0]
vc = conn.execute("SELECT COUNT(*) FROM vehicles WHERE estado='vendido'").fetchone()[0]
cl = conn.execute("SELECT COUNT(*) FROM clients").fetchone()[0]
print(f"\nDone! sales={sr}, vehicles={vc}, clients={cl}")
conn.close()
