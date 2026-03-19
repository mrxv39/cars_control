import sqlite3
import os
import json
import re

DB_PATH = os.path.expandvars(r'%APPDATA%\com.codinacars.carscontrol\data\app.db')
STOCK_DIR = os.path.expandvars(r'%APPDATA%\com.codinacars.carscontrol\data\stock')

with open(r'C:\Users\Usuario\Desktop\proyectos\cars_control\coches_stock.json', 'r', encoding='utf-8') as f:
    vehicles = json.load(f)

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute('SELECT name FROM vehicles')
existing = set(row[0] for row in cursor.fetchall())
print(f'Vehiculos existentes en stock: {len(existing)}')

imported = 0
skipped = 0
for v in vehicles:
    name = v['title']
    # Fix encoding artifacts
    name = re.sub(r'[\udcf3\ufffd]', 'o', name)
    name = re.sub(r'[\udce9]', 'e', name)

    if name in existing:
        print(f'  SKIP: {name}')
        skipped += 1
        continue

    safe_name = re.sub(r'[\\/:*?"<>|]', ' ', name).strip()
    folder_path = os.path.join(STOCK_DIR, safe_name)
    os.makedirs(folder_path, exist_ok=True)

    year = v.get('year')
    km = v.get('km_num')
    precio_venta = v.get('price_num')

    cursor.execute('''
        INSERT OR IGNORE INTO vehicles (folder_path, name, precio_compra, precio_venta, km, anio, estado)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (folder_path, name, None, precio_venta, km, year, 'disponible'))

    url = v.get('url', '')
    if url:
        cursor.execute('''
            INSERT OR REPLACE INTO vehicle_ads (folder_path, url, status, date)
            VALUES (?, ?, ?, ?)
        ''', (folder_path, url, 'publicado', ''))

    print(f'  IMPORTED: {name} | {precio_venta} EUR | {year} | {km} km')
    imported += 1

conn.commit()

cursor.execute('SELECT COUNT(*) FROM vehicles')
total = cursor.fetchone()[0]
print(f'\nImportados: {imported}')
print(f'Ya existian: {skipped}')
print(f'Total vehiculos en stock: {total}')
conn.close()
