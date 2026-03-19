"""
Import all expenses from extracted PDF data into the app database.
"""
import json
import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.expandvars(r'%APPDATA%\com.codinacars.carscontrol\data\app.db')
GASTOS_JSON = os.path.join(os.path.dirname(__file__), 'gastos_parsed.json')

def normalize_date(date_str):
    """Try to normalize various date formats to YYYY-MM-DD."""
    if not date_str:
        return '2025-01-01'

    # Already in YYYY-MM-DD format
    if len(date_str) == 10 and date_str[4] == '-':
        return date_str

    # DD/MM/YYYY
    for fmt in ['%d/%m/%Y', '%d-%m-%Y', '%d/%m/%y']:
        try:
            return datetime.strptime(date_str.strip(), fmt).strftime('%Y-%m-%d')
        except ValueError:
            continue

    # Try DD-MM-YYYY with slash
    parts = date_str.replace('/', '-').split('-')
    if len(parts) == 3:
        day, month, year = parts
        if len(year) == 2:
            year = '20' + year
        try:
            return f'{year}-{month.zfill(2)}-{day.zfill(2)}'
        except:
            pass

    return date_str


def main():
    # First run the extraction if not already done
    if not os.path.exists(GASTOS_JSON):
        print("Running extract_gastos.py first...")
        os.system('python extract_gastos.py')

    with open(GASTOS_JSON, 'r', encoding='utf-8') as f:
        records = json.load(f)

    # Filter out IMAGE_NO_TEXT records (can't extract data from images)
    valid_records = [r for r in records if r['type'] != 'IMAGE_NO_TEXT']

    print(f"Database: {DB_PATH}")
    print(f"Total records to import: {len(valid_records)}")
    print(f"Skipped (images without text): {len(records) - len(valid_records)}")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Drop and recreate table with new schema
    cursor.execute("DROP TABLE IF EXISTS purchase_records")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS purchase_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            expense_type TEXT NOT NULL DEFAULT 'COMPRA_VEHICULO',
            vehicle_folder_path TEXT,
            vehicle_name TEXT,
            plate TEXT,
            supplier_name TEXT NOT NULL,
            purchase_date TEXT NOT NULL,
            purchase_price REAL NOT NULL,
            invoice_number TEXT NOT NULL,
            payment_method TEXT,
            notes TEXT,
            source_file TEXT,
            created_at TEXT NOT NULL
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_purchase_vehicle ON purchase_records(vehicle_folder_path)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_purchase_date ON purchase_records(purchase_date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_purchase_invoice ON purchase_records(invoice_number)")

    now = datetime.utcnow().isoformat() + 'Z'
    imported = 0
    skipped = 0

    for rec in valid_records:
        invoice = rec.get('invoice_number', '').strip()
        if not invoice:
            # Generate one from file name
            invoice = f"DOC-{rec['file'].replace('/', '-').replace(' ', '_')}"

        date = normalize_date(rec.get('date', ''))
        amount = rec.get('amount', 0)

        # Skip records with 0 amount and no useful info
        if amount == 0 and not rec.get('supplier'):
            skipped += 1
            continue

        cursor.execute("""
            INSERT INTO purchase_records
            (expense_type, vehicle_folder_path, vehicle_name, plate, supplier_name,
             purchase_date, purchase_price, invoice_number, payment_method, notes, source_file, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rec.get('type', 'OTRO'),
            '',  # vehicle_folder_path - would need mapping
            rec.get('vehicle', ''),
            rec.get('plate', ''),
            rec.get('supplier', 'Desconocido'),
            date,
            amount,
            invoice,
            rec.get('payment_method', ''),
            rec.get('description', ''),
            rec.get('file', ''),
            now,
        ))
        imported += 1

    conn.commit()

    # Verify
    cursor.execute("SELECT COUNT(*) FROM purchase_records")
    total = cursor.fetchone()[0]

    cursor.execute("SELECT expense_type, COUNT(*), SUM(purchase_price) FROM purchase_records GROUP BY expense_type ORDER BY SUM(purchase_price) DESC")
    print(f"\nImportados: {imported}")
    print(f"Omitidos: {skipped}")
    print(f"Total en BD: {total}")
    print("\n=== RESUMEN POR TIPO ===")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]} registros, {row[2]:,.2f} EUR")

    cursor.execute("SELECT SUM(purchase_price) FROM purchase_records")
    total_amount = cursor.fetchone()[0]
    print(f"\nTOTAL: {total_amount:,.2f} EUR")

    conn.close()
    print("\nImportacion completada.")


if __name__ == '__main__':
    main()
