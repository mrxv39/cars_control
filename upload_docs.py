"""Upload all extracted PDFs to Supabase storage and create vehicle_documents records."""
import os
import re
from supabase import create_client

sb = create_client(
    'https://hyydkyhvgcekvtkrnspf.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5eWRreWh2Z2Nla3Z0a3Juc3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MDU3MDQsImV4cCI6MjA4OTQ4MTcwNH0.54OcvlXRN9Bb7yhxUw2ufhWT2GypqCu3wH26fJuCuRA'
)

# Map folder names to vehicle IDs
FOLDER_TO_VEHICLE = {
    '3972LPG': 11,    # VW T-Cross
    '1925LSJ': 8,     # VW Polo R-Line
    'MAZDA CX30': 12, # Mazda CX-30
    '9481LDD': 9,     # Dacia Lodgy
    '4936LYW': 5,     # VW Polo
    '0223LTZ': 6,     # VW Polo
    '9055JND': 1,     # Mazda CX-3
    '7962LVR': 10,    # Mazda CX-3 Zenith
    'transporter': None,  # Not in DB
    '3439JKL': 13,    # Mazda CX-3 4WD
    '0229LVS': 15,    # Seat Ibiza
}

def get_vehicle_id(folder_name):
    folder_upper = folder_name.upper()
    for key, vid in FOLDER_TO_VEHICLE.items():
        if key.upper() in folder_upper:
            return vid
    return None

def get_doc_type(filename):
    lower = filename.lower()
    if any(w in lower for w in ['factura', 'fra compra', 'factrua']):
        return 'factura'
    elif any(w in lower for w in ['ficha', 'tecnica']):
        return 'ficha_tecnica'
    elif 'permiso' in lower:
        return 'permiso'
    else:
        return 'otro'

BASE_DIR = r'C:\Users\Usuario\Desktop\proyectos\cars_control\docs\extracted_docs\COCHES STOCK'

uploaded = 0
skipped = 0

for root, dirs, files in os.walk(BASE_DIR):
    for filename in files:
        if not filename.lower().endswith('.pdf'):
            continue

        filepath = os.path.join(root, filename)
        # Get the vehicle folder (first subfolder after BASE_DIR)
        rel = os.path.relpath(root, BASE_DIR)
        folder_name = rel.split(os.sep)[0] if rel != '.' else ''

        vehicle_id = get_vehicle_id(folder_name)
        if vehicle_id is None:
            print(f"  SKIP (no vehicle match): {folder_name}/{filename}")
            skipped += 1
            continue

        doc_type = get_doc_type(filename)

        # Clean filename for storage
        clean_name = re.sub(r'[^\w\s.\-]', '', filename).strip()
        storage_path = f"{vehicle_id}/{doc_type}/{clean_name}"

        try:
            with open(filepath, 'rb') as f:
                pdf_bytes = f.read()

            sb.storage.from_('vehicle-docs').upload(
                storage_path, pdf_bytes,
                {"content-type": "application/pdf"}
            )

            sb.table('vehicle_documents').insert({
                'vehicle_id': vehicle_id,
                'doc_type': doc_type,
                'file_name': filename,
                'storage_path': storage_path,
            }).execute()

            uploaded += 1
            print(f"  OK [{doc_type}] vehicle={vehicle_id}: {filename}")
        except Exception as e:
            print(f"  ERROR: {filename} => {e}")

print(f"\nDone. Uploaded: {uploaded}, Skipped: {skipped}")
