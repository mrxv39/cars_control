"""
Import OCR-extracted expenses into the app database.
Merges with the already-imported text-based records.
"""
import json
import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.expandvars(r'%APPDATA%\com.codinacars.carscontrol\data\app.db')
OCR_JSON = os.path.join(os.path.dirname(__file__), 'gastos_ocr_parsed.json')


def normalize_date(date_str):
    if not date_str:
        return '2025-01-01'
    # Already YYYY-MM-DD
    if len(date_str) == 10 and date_str[4] == '-':
        return date_str
    # Try DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY
    for fmt in ['%d/%m/%Y', '%d-%m-%Y', '%d/%m/%y', '%d-%m-%y']:
        try:
            return datetime.strptime(date_str.strip(), fmt).strftime('%Y-%m-%d')
        except ValueError:
            continue
    # Try to parse DD/MM/25 style
    parts = date_str.replace('/', '-').split('-')
    if len(parts) == 3:
        day, month, year = parts[0].strip(), parts[1].strip(), parts[2].strip()
        if len(year) == 2:
            year = '20' + year
        try:
            return f'{year}-{month.zfill(2)}-{day.zfill(2)}'
        except:
            pass
    return date_str


def assign_quarter_date(quarter):
    """Assign approximate date from quarter if no date was found."""
    q_dates = {'T1': '2025-02-15', 'T2': '2025-05-15', 'T3': '2025-08-15', 'T4': '2025-11-15'}
    return q_dates.get(quarter, '2025-06-15')


def main():
    with open(OCR_JSON, 'r', encoding='utf-8') as f:
        records = json.load(f)

    print(f"Database: {DB_PATH}")
    print(f"OCR records to import: {len(records)}")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check current count
    cursor.execute("SELECT COUNT(*) FROM purchase_records")
    existing = cursor.fetchone()[0]
    print(f"Existing records in DB: {existing}")

    now = datetime.utcnow().isoformat() + 'Z'
    imported = 0
    skipped = 0

    for rec in records:
        if rec.get('type') == 'OCR_ERROR':
            skipped += 1
            continue

        invoice = rec.get('invoice_number', '').strip()
        if not invoice:
            invoice = f"OCR-{rec['file'].replace('/', '-').replace(' ', '_')}"

        date = normalize_date(rec.get('date', ''))
        if date == '2025-01-01' or not date or len(date) < 8:
            date = assign_quarter_date(rec.get('quarter', ''))

        amount = rec.get('amount', 0)

        # Sanity check: taller/recambios invoices over 5000 EUR are likely OCR errors
        if rec['type'] in ('TALLER', 'RECAMBIOS', 'NEUMATICOS', 'LIMPIEZA', 'SERVICIOS', 'COMBUSTIBLE', 'BANCO', 'AUTONOMO') and amount > 5000:
            amount = 0  # Reset suspicious amounts

        # Skip if no useful data at all
        supplier = rec.get('supplier', '')
        if not supplier and amount == 0:
            skipped += 1
            continue

        if not supplier:
            supplier = 'Desconocido (OCR)'

        cursor.execute("""
            INSERT INTO purchase_records
            (expense_type, vehicle_folder_path, vehicle_name, plate, supplier_name,
             purchase_date, purchase_price, invoice_number, payment_method, notes, source_file, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rec.get('type', 'OTRO'),
            '',
            rec.get('vehicle', ''),
            rec.get('plate', ''),
            supplier,
            date,
            amount,
            invoice,
            '',
            rec.get('description', ''),
            rec.get('file', ''),
            now,
        ))
        imported += 1

    conn.commit()

    # Final summary
    cursor.execute("SELECT COUNT(*) FROM purchase_records")
    total = cursor.fetchone()[0]

    cursor.execute("""
        SELECT expense_type, COUNT(*), ROUND(SUM(purchase_price), 2)
        FROM purchase_records
        GROUP BY expense_type
        ORDER BY SUM(purchase_price) DESC
    """)
    print(f"\nNuevos importados (OCR): {imported}")
    print(f"Omitidos: {skipped}")
    print(f"Total en BD: {total}")
    print("\n=== RESUMEN TOTAL (texto + OCR) ===")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]} registros, {row[2]:,.2f} EUR")

    cursor.execute("SELECT ROUND(SUM(purchase_price), 2) FROM purchase_records")
    total_amount = cursor.fetchone()[0]
    print(f"\nTOTAL GASTOS 2025: {total_amount:,.2f} EUR")

    cursor.execute("SELECT COUNT(*) FROM purchase_records WHERE expense_type = 'COMPRA_VEHICULO'")
    n_compras = cursor.fetchone()[0]
    cursor.execute("SELECT ROUND(SUM(purchase_price), 2) FROM purchase_records WHERE expense_type = 'COMPRA_VEHICULO'")
    total_compras = cursor.fetchone()[0]
    print(f"  - Compras vehiculos: {n_compras} registros, {total_compras:,.2f} EUR")

    conn.close()
    print("\nImportacion OCR completada.")


if __name__ == '__main__':
    main()
