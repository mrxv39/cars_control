"""Insert all purchase records from extracted invoices."""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://kpgkcersrfvzncqupkxa.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_ANON_KEY', '')
if not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_ANON_KEY env var is required. Set it in .env")
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

COMPANY_ID = 1
VW = 1; IBER = 2; AUTO1 = 3; EULALIA = 4; JUANMA = 5

purchase_records = [
    {
        'company_id': COMPANY_ID,
        'expense_type': 'COMPRA_VEHICULO',
        'vehicle_id': 11,
        'vehicle_name': 'VOLKSWAGEN T-Cross Sport 1.0 TSI',
        'plate': '3972LPG',
        'supplier_name': 'Volkswagen Bank GmbH Sucursal en Espana',
        'supplier_id': VW,
        'purchase_date': '2025-07-07',
        'purchase_price': 13600.00,
        'invoice_number': 'FA-4502815',
        'payment_method': '',
        'notes': 'VIN: WVGZZZC1ZMY073992 | 114.345 km | IVA 21% (Base: 11.239,67 + IVA: 2.360,33)',
    },
    {
        'company_id': COMPANY_ID,
        'expense_type': 'COMPRA_VEHICULO',
        'vehicle_id': 8,
        'vehicle_name': 'VOLKSWAGEN Polo RLine 1.0 TSI DSG',
        'plate': '1925LSJ',
        'supplier_name': 'Volkswagen Renting, S.A.',
        'supplier_id': VW,
        'purchase_date': '2025-08-11',
        'purchase_price': 12900.00,
        'invoice_number': 'FA-2513990',
        'payment_method': '',
        'notes': 'VIN: WVWZZZAWZMY075526 | 111.527 km | IVA 21% (Base: 10.661,16 + IVA: 2.238,84)',
    },
    {
        'company_id': COMPANY_ID,
        'expense_type': 'COMPRA_VEHICULO',
        'vehicle_id': 12,
        'vehicle_name': 'MAZDA CX-30 SKYACTIVG 2.0 2WD Zenith Safety',
        'plate': '3044LCC',
        'supplier_name': 'AUTO1 European Cars B.V.',
        'supplier_id': AUTO1,
        'purchase_date': '2025-10-22',
        'purchase_price': 13650.00,
        'invoice_number': '90072501088316',
        'payment_method': '',
        'notes': 'VIN: JMZDM6WE600116156 | 123.736 km | REBU | Order: ESPR00733214',
    },
    {
        'company_id': COMPANY_ID,
        'expense_type': 'COMISION',
        'vehicle_id': 12,
        'vehicle_name': 'MAZDA CX-30 - Comisiones AUTO1',
        'plate': '3044LCC',
        'supplier_name': 'AUTO1 Group Operations SE (Berlin)',
        'supplier_id': AUTO1,
        'purchase_date': '2025-10-22',
        'purchase_price': 438.00,
        'invoice_number': '10025011001062',
        'payment_method': '',
        'notes': 'Document Handling: 189 + Car Handling: 249 | Intracomunitario IVA reverse charge',
    },
    {
        'company_id': COMPANY_ID,
        'expense_type': 'COMPRA_VEHICULO',
        'vehicle_id': 9,
        'vehicle_name': 'DACIA Lodgy Comfort Blue dCi 5Pl 18',
        'plate': '9481LDD',
        'supplier_name': 'AUTO1 European Cars B.V.',
        'supplier_id': AUTO1,
        'purchase_date': '2025-10-22',
        'purchase_price': 9500.00,
        'invoice_number': '90072501088391',
        'payment_method': '',
        'notes': 'VIN: UU1J9220664324962 | 51.198 km | REBU | Order: ESPR00733192',
    },
    {
        'company_id': COMPANY_ID,
        'expense_type': 'COMISION',
        'vehicle_id': 9,
        'vehicle_name': 'DACIA Lodgy - Comisiones AUTO1',
        'plate': '9481LDD',
        'supplier_name': 'AUTO1 Group Operations SE (Berlin)',
        'supplier_id': AUTO1,
        'purchase_date': '2025-10-22',
        'purchase_price': 1438.00,
        'invoice_number': '10025011001153',
        'payment_method': '',
        'notes': 'Document Handling: 189 + Car Handling: 249 + Auction Fee: 1.000 | Intracomunitario',
    },
    {
        'company_id': COMPANY_ID,
        'expense_type': 'COMPRA_VEHICULO',
        'vehicle_id': 5,
        'vehicle_name': 'VOLKSWAGEN Polo Advance 1.0 TSI',
        'plate': '4936LYW',
        'supplier_name': 'Volkswagen Renting, S.A.',
        'supplier_id': VW,
        'purchase_date': '2025-10-30',
        'purchase_price': 11900.00,
        'invoice_number': 'FA-2519319',
        'payment_method': '',
        'notes': 'VIN: WVWZZZAWZNY052594 | 90.239 km | IVA 21% (Base: 9.834,71 + IVA: 2.065,29)',
    },
    {
        'company_id': COMPANY_ID,
        'expense_type': 'COMPRA_VEHICULO',
        'vehicle_id': 6,
        'vehicle_name': 'VOLKSWAGEN Polo Life 1.0 TSI',
        'plate': '0223LTZ',
        'supplier_name': 'Volkswagen Renting, S.A.',
        'supplier_id': VW,
        'purchase_date': '2025-11-26',
        'purchase_price': 12500.00,
        'invoice_number': 'FA-2520740',
        'payment_method': '',
        'notes': 'VIN: WVWZZZAWZMY082852 | 79.476 km | IVA 21% (Base: 10.330,58 + IVA: 2.169,42)',
    },
    {
        'company_id': COMPANY_ID,
        'expense_type': 'COMPRA_VEHICULO',
        'vehicle_id': 1,
        'vehicle_name': 'MAZDA CX-3 2.0 120CV Style',
        'plate': '9055JND',
        'supplier_name': 'Ibersport - Corporacio Ligoria 200, S.L.',
        'supplier_id': IBER,
        'purchase_date': '2026-01-15',
        'purchase_price': 12500.00,
        'invoice_number': 'VOTCL26-5',
        'payment_method': '',
        'notes': 'VIN: JMZDK6W7610151619 | 44.168 km | Color: Artic White | REBU | 1a matriculacion: 15/04/2016',
    },
    {
        'company_id': COMPANY_ID,
        'expense_type': 'COMPRA_VEHICULO',
        'vehicle_id': None,
        'vehicle_name': 'VOLKSWAGEN Transporter 1.9 TDI 104CV',
        'plate': '2091DJR',
        'supplier_name': 'Eulalia Zaballa Camprubi (Particular)',
        'supplier_id': EULALIA,
        'purchase_date': '2026-01-23',
        'purchase_price': 3500.00,
        'invoice_number': 'C26/01',
        'payment_method': '',
        'notes': 'VIN: WV2ZZZ7H5H051508 | 326.000 km | Blanco | Diesel | REBU | 1a matr: 22/04/2005',
    },
    {
        'company_id': COMPANY_ID,
        'expense_type': 'COMPRA_VEHICULO',
        'vehicle_id': 10,
        'vehicle_name': 'MAZDA CX-3 2.0 121CV Zenith',
        'plate': '7962LVR',
        'supplier_name': 'Ibersport - Corporacio Ligoria 200, S.L.',
        'supplier_id': IBER,
        'purchase_date': '2026-02-05',
        'purchase_price': 15500.00,
        'invoice_number': 'VOGTCL26-11',
        'payment_method': '',
        'notes': 'VIN: JMZDK6WE601515209 | 43.331 km | Color: Snowflake White Pearl | IVA 21%',
    },
    {
        'company_id': COMPANY_ID,
        'expense_type': 'COMPRA_VEHICULO',
        'vehicle_id': 13,
        'vehicle_name': 'MAZDA CX-3 2.0 150CV AT Luxury 4WD',
        'plate': '3439JKL',
        'supplier_name': 'Ibersport - Corporacio Ligoria 200, S.L.',
        'supplier_id': IBER,
        'purchase_date': '2026-02-13',
        'purchase_price': 12650.00,
        'invoice_number': 'VOTCL26-29',
        'payment_method': '',
        'notes': 'VIN: JMZDKFW7A20130476 | 86.098 km | Color: Soul Red | REBU | 1a matr: 01/12/2015',
    },
    {
        'company_id': COMPANY_ID,
        'expense_type': 'COMPRA_VEHICULO',
        'vehicle_id': 15,
        'vehicle_name': 'SEAT Ibiza 1.0 MPI 80CV',
        'plate': '0229LVS',
        'supplier_name': 'Juan Manuel Ramos Bohorquez (Particular)',
        'supplier_id': JUANMA,
        'purchase_date': '2026-03-05',
        'purchase_price': 11000.00,
        'invoice_number': 'C26/02',
        'payment_method': '',
        'notes': 'VIN: VSSZZZKJZNR047211 | 97.000 km | Blanco | Gasolina | REBU | 1a matr: 29/12/2021',
    },
]

# Also update precio_compra on vehicles
vehicle_prices = {
    11: 13600,   # T-Cross
    8: 12900,    # Polo R-Line
    12: 14088,   # CX-30 (13650 + 438 comisiones)
    9: 10938,    # Lodgy (9500 + 1438 comisiones)
    5: 11900,    # Polo 4936LYW
    6: 12500,    # Polo 0223LTZ
    1: 12500,    # CX-3 9055JND
    10: 15500,   # CX-3 7962LVR
    13: 12650,   # CX-3 3439JKL
    15: 11000,   # Ibiza
}

result = sb.table('purchase_records').insert(purchase_records).execute()
print(f"Inserted {len(result.data)} purchase records")
for r in result.data:
    print(f"  id={r['id']}: {r['plate']} | {r['purchase_price']}E | {r['purchase_date']}")

print("\nUpdating vehicle purchase prices...")
for vid, price in vehicle_prices.items():
    sb.table('vehicles').update({'precio_compra': price}).eq('id', vid).execute()
    print(f"  vehicle id={vid}: precio_compra = {price}E")

print("\nDone!")
