use rusqlite::{Connection, OptionalExtension, Result as SqlResult};
use sha2::{Sha256, Digest};
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;

use crate::{Client, Lead, StockVehicle, VehicleAdInfo};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Auth: {0}")]
    Auth(String),
    #[error("IO: {0}")]
    Io(#[from] std::io::Error),
}

impl From<AppError> for String {
    fn from(err: AppError) -> String {
        err.to_string()
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Company {
    pub id: u64,
    pub trade_name: String,
    pub legal_name: String,
    pub cif: String,
    pub address: String,
    pub phone: String,
    pub email: String,
    pub created_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct User {
    pub id: u64,
    pub company_id: u64,
    pub full_name: String,
    pub username: String,
    pub role: String,
    pub active: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LoginResult {
    pub user: User,
    pub company: Company,
}

const PBKDF2_ITERATIONS: u32 = 600_000;
const HASH_LENGTH: usize = 32; // 256 bits
const SALT_LENGTH: usize = 16; // 128 bits

/// Hashea un password con PBKDF2-SHA256 (600k iteraciones, salt aleatorio).
/// Formato: "pbkdf2:600000:<salt_hex>:<hash_hex>"
pub fn hash_password(password: &str) -> String {
    let mut salt = [0u8; SALT_LENGTH];
    rand::thread_rng().fill_bytes(&mut salt);

    let mut hash = [0u8; HASH_LENGTH];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), &salt, PBKDF2_ITERATIONS, &mut hash);

    format!("pbkdf2:{}:{}:{}", PBKDF2_ITERATIONS, hex::encode(salt), hex::encode(hash))
}

/// Hash SHA-256 legacy (solo para compatibilidad con datos existentes, NO usar para nuevos passwords).
fn legacy_sha256_hash(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(format!("codinacars_salt_{}", password));
    hex::encode(hasher.finalize())
}

/// Verifica un password contra un hash almacenado.
/// Soporta PBKDF2 (nuevo) y SHA-256 legacy (migración gradual).
/// Retorna (valid, Option<new_hash>) — new_hash presente si se debe actualizar el hash en BD.
fn verify_password(password: &str, stored_hash: &str) -> (bool, Option<String>) {
    if stored_hash.starts_with("pbkdf2:") {
        let parts: Vec<&str> = stored_hash.split(':').collect();
        if parts.len() != 4 { return (false, None); }

        let iterations: u32 = match parts[1].parse() { Ok(n) => n, Err(_) => return (false, None) };
        let salt = match hex::decode(parts[2]) { Ok(s) => s, Err(_) => return (false, None) };
        let expected = match hex::decode(parts[3]) { Ok(h) => h, Err(_) => return (false, None) };

        let mut derived = vec![0u8; expected.len()];
        pbkdf2_hmac::<Sha256>(password.as_bytes(), &salt, iterations, &mut derived);

        // Comparación en tiempo constante
        let valid = derived.len() == expected.len()
            && derived.iter().zip(expected.iter()).fold(0u8, |acc, (a, b)| acc | (a ^ b)) == 0;

        (valid, None)
    } else {
        // SHA-256 legacy — verificar y proponer migración
        let legacy = legacy_sha256_hash(password);
        if legacy == stored_hash {
            let new_hash = hash_password(password);
            (true, Some(new_hash))
        } else {
            (false, None)
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PurchaseRecord {
    pub id: u64,
    pub expense_type: String,
    pub vehicle_folder_path: String,
    pub vehicle_name: String,
    pub plate: String,
    pub supplier_name: String,
    pub purchase_date: String,
    pub purchase_price: f64,
    pub invoice_number: String,
    pub payment_method: String,
    pub notes: String,
    pub source_file: String,
    pub created_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LeadNote {
    pub id: u64,
    pub lead_id: u64,
    pub timestamp: String, // ISO 8601 format
    pub content: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SalesTransaction {
    pub id: u64,
    pub year: i32,
    pub month: Option<i32>,
    pub sale_date: String,
    pub invoice_number: Option<String>,
    pub vehicle_name: String,
    pub vehicle_model: Option<String>,
    pub plate: Option<String>,
    pub client_name: Option<String>,
    pub client_dni: Option<String>,
    pub client_id: Option<u64>,
    pub purchase_price: Option<f64>,
    pub sale_price: f64,
    pub profit: Option<f64>,
    pub payment_method: Option<String>,
    pub notes: Option<String>,
    pub documents_path: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SalesRecord {
    pub id: u64,
    pub vehicle_folder_path: String,
    pub client_id: Option<u64>,
    pub lead_id: Option<u64>,
    pub price_final: f64,
    pub date: String, // ISO 8601 format
    pub notes: String,
}

/// Initialize the SQLite database with all necessary tables
pub fn init_db(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS vehicles (
            folder_path TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            precio_compra REAL,
            precio_venta REAL,
            km INTEGER,
            anio INTEGER,
            estado TEXT DEFAULT 'disponible'
        );

        CREATE TABLE IF NOT EXISTS vehicle_ads (
            folder_path TEXT PRIMARY KEY,
            url TEXT,
            status TEXT,
            date TEXT,
            FOREIGN KEY(folder_path) REFERENCES vehicles(folder_path) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            notes TEXT,
            vehicle_interest TEXT,
            vehicle_folder_path TEXT,
            converted_client_id INTEGER,
            estado TEXT DEFAULT 'nuevo',
            fecha_contacto TEXT,
            canal TEXT,
            FOREIGN KEY(vehicle_folder_path) REFERENCES vehicles(folder_path)
        );

        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            dni TEXT,
            notes TEXT,
            vehicle_folder_path TEXT,
            source_lead_id INTEGER,
            FOREIGN KEY(vehicle_folder_path) REFERENCES vehicles(folder_path),
            FOREIGN KEY(source_lead_id) REFERENCES leads(id)
        );

        CREATE TABLE IF NOT EXISTS lead_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            content TEXT NOT NULL,
            FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS sales_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_folder_path TEXT NOT NULL,
            client_id INTEGER,
            lead_id INTEGER,
            price_final REAL NOT NULL,
            date TEXT NOT NULL,
            notes TEXT,
            FOREIGN KEY(vehicle_folder_path) REFERENCES vehicles(folder_path),
            FOREIGN KEY(client_id) REFERENCES clients(id),
            FOREIGN KEY(lead_id) REFERENCES leads(id)
        );

        CREATE TABLE IF NOT EXISTS sales_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER NOT NULL,
            month INTEGER,
            sale_date TEXT NOT NULL,
            invoice_number TEXT UNIQUE,
            vehicle_name TEXT NOT NULL,
            vehicle_model TEXT,
            plate TEXT,
            client_name TEXT,
            client_dni TEXT,
            client_id INTEGER,
            purchase_price REAL,
            sale_price REAL NOT NULL,
            profit REAL,
            payment_method TEXT,
            notes TEXT,
            documents_path TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(client_id) REFERENCES clients(id)
        );

        CREATE INDEX IF NOT EXISTS idx_leads_estado ON leads(estado);
        CREATE INDEX IF NOT EXISTS idx_leads_vehicle ON leads(vehicle_folder_path);
        CREATE INDEX IF NOT EXISTS idx_clients_vehicle ON clients(vehicle_folder_path);
        CREATE INDEX IF NOT EXISTS idx_lead_notes_lead ON lead_notes(lead_id);
        CREATE INDEX IF NOT EXISTS idx_lead_notes_timestamp ON lead_notes(timestamp);
        CREATE INDEX IF NOT EXISTS idx_sales_vehicle ON sales_records(vehicle_folder_path);
        CREATE INDEX IF NOT EXISTS idx_sales_client ON sales_records(client_id);
        CREATE INDEX IF NOT EXISTS idx_sales_date ON sales_records(date);

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
        );

        CREATE INDEX IF NOT EXISTS idx_sales_trans_year ON sales_transactions(year);
        CREATE INDEX IF NOT EXISTS idx_sales_trans_client ON sales_transactions(client_id);
        CREATE INDEX IF NOT EXISTS idx_sales_trans_date ON sales_transactions(sale_date);
        CREATE INDEX IF NOT EXISTS idx_sales_trans_invoice ON sales_transactions(invoice_number);

        CREATE INDEX IF NOT EXISTS idx_purchase_vehicle ON purchase_records(vehicle_folder_path);
        CREATE INDEX IF NOT EXISTS idx_purchase_date ON purchase_records(purchase_date);
        CREATE INDEX IF NOT EXISTS idx_purchase_invoice ON purchase_records(invoice_number);

        CREATE TABLE IF NOT EXISTS companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trade_name TEXT NOT NULL,
            legal_name TEXT,
            cif TEXT,
            address TEXT,
            phone TEXT,
            email TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL,
            full_name TEXT NOT NULL,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'admin',
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            FOREIGN KEY(company_id) REFERENCES companies(id)
        );
        ",
    )?;

    seed_default_data(conn)?;
    crate::platform::init_platform_tables(conn)?;
    Ok(())
}

/// Seed default company and user if none exist
fn seed_default_data(conn: &Connection) -> SqlResult<()> {
    let count: u64 = conn.query_row("SELECT COUNT(*) FROM companies", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO companies (trade_name, legal_name, cif, address, phone, email, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            "CodinaCars",
            "Codina Ludeña, Ricard",
            "47788643W",
            "C/ Sant Antoni Maria Claret 3, Bajos 2, 08750 Molins de Rei",
            "646 13 15 65",
            "codinacars@gmail.com",
            &now,
        ],
    )?;

    let password_hash = hash_password("admin");
    conn.execute(
        "INSERT INTO users (company_id, full_name, username, password_hash, role, active, created_at)
         VALUES (1, ?, ?, ?, 'admin', 1, ?)",
        [
            "Ricard Codina Ludeña",
            "ricard",
            &password_hash,
            &now,
        ],
    )?;

    Ok(())
}

/// Load all vehicles from the database
pub fn load_vehicles(conn: &Connection) -> SqlResult<Vec<StockVehicle>> {
    let mut stmt = conn.prepare(
        "SELECT v.folder_path, v.name, v.precio_compra, v.precio_venta, v.km, v.anio, v.estado,
                a.url, a.status, a.date
         FROM vehicles v
         LEFT JOIN vehicle_ads a ON v.folder_path = a.folder_path
         ORDER BY v.folder_path"
    )?;

    let vehicles = stmt.query_map([], |row| {
        let folder_path: String = row.get(0)?;
        let name: String = row.get(1)?;
        let precio_compra: Option<f64> = row.get(2)?;
        let precio_venta: Option<f64> = row.get(3)?;
        let km: Option<u32> = row.get(4)?;
        let anio: Option<u16> = row.get(5)?;
        let estado: String = row.get(6)?;
        let url: Option<String> = row.get(7)?;
        let status: Option<String> = row.get(8)?;
        let date: Option<String> = row.get(9)?;

        let ad_info = if url.is_some() || status.is_some() || date.is_some() {
            Some(VehicleAdInfo {
                url: url.unwrap_or_default(),
                status: status.unwrap_or_default(),
                date: date.unwrap_or_default(),
            })
        } else {
            None
        };

        Ok(StockVehicle {
            name,
            folder_path,
            ad_info,
            precio_compra,
            precio_venta,
            km,
            anio,
            estado,
        })
    })?;

    vehicles.collect()
}

/// Load all leads from the database
pub fn load_leads(conn: &Connection) -> SqlResult<Vec<Lead>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, phone, email, notes, vehicle_interest, vehicle_folder_path,
                converted_client_id, estado, fecha_contacto, canal
         FROM leads
         ORDER BY id DESC"
    )?;

    let leads = stmt.query_map([], |row| {
        Ok(Lead {
            id: row.get(0)?,
            name: row.get(1)?,
            phone: row.get(2)?,
            email: row.get(3)?,
            notes: row.get(4)?,
            vehicle_interest: row.get(5)?,
            vehicle_folder_path: row.get(6)?,
            converted_client_id: row.get(7)?,
            estado: row.get(8)?,
            fecha_contacto: row.get(9)?,
            canal: row.get(10)?,
        })
    })?;

    leads.collect()
}

/// Load all clients from the database
pub fn load_clients(conn: &Connection) -> SqlResult<Vec<Client>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, phone, email, dni, notes, vehicle_folder_path, source_lead_id
         FROM clients
         ORDER BY id DESC"
    )?;

    let clients = stmt.query_map([], |row| {
        Ok(Client {
            id: row.get(0)?,
            name: row.get(1)?,
            phone: row.get(2)?,
            email: row.get(3)?,
            dni: row.get(4)?,
            notes: row.get(5)?,
            vehicle_folder_path: row.get(6)?,
            source_lead_id: row.get(7)?,
        })
    })?;

    clients.collect()
}

/// Save a vehicle to the database
pub fn save_vehicle(conn: &Connection, vehicle: &StockVehicle) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO vehicles (folder_path, name, precio_compra, precio_venta, km, anio, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            vehicle.folder_path.clone(),
            vehicle.name.clone(),
            vehicle.precio_compra.map(|p| p.to_string()).unwrap_or_default(),
            vehicle.precio_venta.map(|p| p.to_string()).unwrap_or_default(),
            vehicle.km.map(|k| k.to_string()).unwrap_or_default(),
            vehicle.anio.map(|a| a.to_string()).unwrap_or_default(),
            vehicle.estado.clone(),
        ],
    )?;

    // Save ad info if present
    if let Some(ad) = &vehicle.ad_info {
        conn.execute(
            "INSERT OR REPLACE INTO vehicle_ads (folder_path, url, status, date)
             VALUES (?, ?, ?, ?)",
            [
                vehicle.folder_path.clone(),
                ad.url.clone(),
                ad.status.clone(),
                ad.date.clone(),
            ],
        )?;
    }

    Ok(())
}

/// Delete a vehicle from the database
pub fn delete_vehicle(conn: &Connection, folder_path: &str) -> SqlResult<()> {
    conn.execute("DELETE FROM vehicles WHERE folder_path = ?", [folder_path])?;
    Ok(())
}

/// Save a lead to the database
pub fn save_lead(conn: &Connection, lead: &Lead) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO leads (id, name, phone, email, notes, vehicle_interest,
          vehicle_folder_path, converted_client_id, estado, fecha_contacto, canal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            lead.id.to_string(),
            lead.name.clone(),
            lead.phone.clone(),
            lead.email.clone(),
            lead.notes.clone(),
            lead.vehicle_interest.clone(),
            lead.vehicle_folder_path.clone().unwrap_or_default(),
            lead.converted_client_id.map(|id| id.to_string()).unwrap_or_default(),
            lead.estado.clone(),
            lead.fecha_contacto.clone().unwrap_or_default(),
            lead.canal.clone().unwrap_or_default(),
        ],
    )?;
    Ok(())
}

/// Add a new lead to the database (generates ID)
pub fn add_lead(conn: &Connection, lead: &Lead) -> SqlResult<Lead> {
    // Get next ID
    let next_id: u64 = conn.query_row(
        "SELECT COALESCE(MAX(id), 0) + 1 FROM leads",
        [],
        |row| row.get(0)
    )?;

    let new_lead = Lead {
        id: next_id,
        ..lead.clone()
    };

    save_lead(conn, &new_lead)?;
    Ok(new_lead)
}

/// Delete a lead from the database
pub fn delete_lead(conn: &Connection, id: u64) -> SqlResult<()> {
    conn.execute("DELETE FROM leads WHERE id = ?", [id.to_string()])?;
    Ok(())
}

/// Save a client to the database
pub fn save_client(conn: &Connection, client: &Client) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO clients (id, name, phone, email, dni, notes,
          vehicle_folder_path, source_lead_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
            client.id.to_string(),
            client.name.clone(),
            client.phone.clone(),
            client.email.clone(),
            client.dni.clone(),
            client.notes.clone(),
            client.vehicle_folder_path.clone().unwrap_or_default(),
            client.source_lead_id.map(|id| id.to_string()).unwrap_or_default(),
        ],
    )?;
    Ok(())
}

/// Add a new client to the database (generates ID)
pub fn add_client(conn: &Connection, client: &Client) -> SqlResult<Client> {
    // Get next ID
    let next_id: u64 = conn.query_row(
        "SELECT COALESCE(MAX(id), 0) + 1 FROM clients",
        [],
        |row| row.get(0)
    )?;

    let new_client = Client {
        id: next_id,
        ..client.clone()
    };

    save_client(conn, &new_client)?;
    Ok(new_client)
}

/// Delete a client from the database
pub fn delete_client(conn: &Connection, id: u64) -> SqlResult<()> {
    conn.execute("DELETE FROM clients WHERE id = ?", [id.to_string()])?;
    Ok(())
}

/// Get all sales transactions
pub fn get_sales_transactions(conn: &Connection) -> SqlResult<Vec<SalesTransaction>> {
    let mut stmt = conn.prepare(
        "SELECT id, year, month, sale_date, invoice_number, vehicle_name, vehicle_model, plate,
                client_name, client_dni, client_id, purchase_price, sale_price, profit,
                payment_method, notes, documents_path, created_at
         FROM sales_transactions
         ORDER BY year DESC, sale_date DESC"
    )?;

    let transactions = stmt.query_map([], |row| {
        Ok(SalesTransaction {
            id: row.get(0)?,
            year: row.get(1)?,
            month: row.get(2)?,
            sale_date: row.get(3)?,
            invoice_number: row.get(4)?,
            vehicle_name: row.get(5)?,
            vehicle_model: row.get(6)?,
            plate: row.get(7)?,
            client_name: row.get(8)?,
            client_dni: row.get(9)?,
            client_id: row.get(10)?,
            purchase_price: row.get(11)?,
            sale_price: row.get(12)?,
            profit: row.get(13)?,
            payment_method: row.get(14)?,
            notes: row.get(15)?,
            documents_path: row.get(16)?,
            created_at: row.get(17)?,
        })
    })?;

    transactions.collect()
}

/// Add a sales transaction
pub fn add_sales_transaction(
    conn: &Connection,
    year: i32,
    month: Option<i32>,
    sale_date: &str,
    invoice_number: Option<&str>,
    vehicle_name: &str,
    vehicle_model: Option<&str>,
    plate: Option<&str>,
    client_name: Option<&str>,
    client_dni: Option<&str>,
    client_id: Option<u64>,
    purchase_price: Option<f64>,
    sale_price: f64,
    profit: Option<f64>,
    payment_method: Option<&str>,
    notes: Option<&str>,
) -> SqlResult<SalesTransaction> {
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO sales_transactions
         (year, month, sale_date, invoice_number, vehicle_name, vehicle_model, plate,
          client_name, client_dni, client_id, purchase_price, sale_price, profit,
          payment_method, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            year.to_string(),
            month.map(|m| m.to_string()).unwrap_or_default(),
            sale_date.to_string(),
            invoice_number.unwrap_or("").to_string(),
            vehicle_name.to_string(),
            vehicle_model.unwrap_or("").to_string(),
            plate.unwrap_or("").to_string(),
            client_name.unwrap_or("").to_string(),
            client_dni.unwrap_or("").to_string(),
            client_id.map(|id| id.to_string()).unwrap_or_default(),
            purchase_price.map(|p| p.to_string()).unwrap_or_default(),
            sale_price.to_string(),
            profit.map(|p| p.to_string()).unwrap_or_default(),
            payment_method.unwrap_or("").to_string(),
            notes.unwrap_or("").to_string(),
            now.clone(),
        ],
    )?;

    // Get the inserted transaction
    let id: u64 = conn.query_row(
        "SELECT last_insert_rowid()",
        [],
        |row| row.get(0)
    )?;

    Ok(SalesTransaction {
        id,
        year,
        month,
        sale_date: sale_date.to_string(),
        invoice_number: invoice_number.map(|s| s.to_string()),
        vehicle_name: vehicle_name.to_string(),
        vehicle_model: vehicle_model.map(|s| s.to_string()),
        plate: plate.map(|s| s.to_string()),
        client_name: client_name.map(|s| s.to_string()),
        client_dni: client_dni.map(|s| s.to_string()),
        client_id,
        purchase_price,
        sale_price,
        profit,
        payment_method: payment_method.map(|s| s.to_string()),
        notes: notes.map(|s| s.to_string()),
        documents_path: None,
        created_at: now,
    })
}

/// Migrate from JSON files to SQLite database
pub fn migrate_from_json(
    conn: &mut Connection,
    stock_data: Vec<StockVehicle>,
    leads_data: Vec<Lead>,
    clients_data: Vec<Client>,
) -> SqlResult<()> {
    let tx = conn.transaction()?;

    // Migrate vehicles
    for vehicle in stock_data {
        save_vehicle(&tx, &vehicle)?;
    }

    // Migrate leads
    for lead in leads_data {
        save_lead(&tx, &lead)?;
    }

    // Migrate clients
    for client in clients_data {
        save_client(&tx, &client)?;
    }

    tx.commit()?;
    Ok(())
}

/// Get all notes for a lead
pub fn get_lead_notes(conn: &Connection, lead_id: u64) -> SqlResult<Vec<LeadNote>> {
    let mut stmt = conn.prepare(
        "SELECT id, lead_id, timestamp, content FROM lead_notes WHERE lead_id = ? ORDER BY timestamp DESC"
    )?;

    let notes = stmt.query_map([lead_id.to_string()], |row| {
        Ok(LeadNote {
            id: row.get(0)?,
            lead_id: row.get(1)?,
            timestamp: row.get(2)?,
            content: row.get(3)?,
        })
    })?;

    notes.collect()
}

/// Add a note to a lead
pub fn add_lead_note(conn: &Connection, lead_id: u64, content: &str) -> SqlResult<LeadNote> {
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO lead_notes (lead_id, timestamp, content) VALUES (?, ?, ?)",
        [lead_id.to_string(), now.clone(), content.to_string()],
    )?;

    let id: u64 = conn.last_insert_rowid() as u64;
    Ok(LeadNote {
        id,
        lead_id,
        timestamp: now,
        content: content.to_string(),
    })
}

/// Delete a note
pub fn delete_lead_note(conn: &Connection, note_id: u64) -> SqlResult<()> {
    conn.execute("DELETE FROM lead_notes WHERE id = ?", [note_id.to_string()])?;
    Ok(())
}

/// Get all sales records
pub fn get_sales_records(conn: &Connection) -> SqlResult<Vec<SalesRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, vehicle_folder_path, client_id, lead_id, price_final, date, notes
         FROM sales_records ORDER BY date DESC"
    )?;

    let records = stmt.query_map([], |row| {
        Ok(SalesRecord {
            id: row.get(0)?,
            vehicle_folder_path: row.get(1)?,
            client_id: row.get(2)?,
            lead_id: row.get(3)?,
            price_final: row.get(4)?,
            date: row.get(5)?,
            notes: row.get(6)?,
        })
    })?;

    records.collect()
}

/// Add a sales record
pub fn add_sales_record(
    conn: &Connection,
    vehicle_folder_path: &str,
    client_id: Option<u64>,
    lead_id: Option<u64>,
    price_final: f64,
    notes: &str,
) -> SqlResult<SalesRecord> {
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO sales_records (vehicle_folder_path, client_id, lead_id, price_final, date, notes)
         VALUES (?, ?, ?, ?, ?, ?)",
        [
            vehicle_folder_path.to_string(),
            client_id.map(|id| id.to_string()).unwrap_or_default(),
            lead_id.map(|id| id.to_string()).unwrap_or_default(),
            price_final.to_string(),
            now.clone(),
            notes.to_string(),
        ],
    )?;

    let id: u64 = conn.last_insert_rowid() as u64;
    Ok(SalesRecord {
        id,
        vehicle_folder_path: vehicle_folder_path.to_string(),
        client_id,
        lead_id,
        price_final,
        date: now,
        notes: notes.to_string(),
    })
}

/// Delete a sales record
pub fn delete_sales_record(conn: &Connection, record_id: u64) -> SqlResult<()> {
    conn.execute("DELETE FROM sales_records WHERE id = ?", [record_id.to_string()])?;
    Ok(())
}

/// Get all purchase records
pub fn get_purchase_records(conn: &Connection) -> SqlResult<Vec<PurchaseRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, expense_type, vehicle_folder_path, vehicle_name, plate, supplier_name,
                purchase_date, purchase_price, invoice_number, payment_method, notes, source_file, created_at
         FROM purchase_records ORDER BY purchase_date DESC"
    )?;

    let records = stmt.query_map([], |row| {
        Ok(PurchaseRecord {
            id: row.get(0)?,
            expense_type: row.get::<_, Option<String>>(1)?.unwrap_or_else(|| "COMPRA_VEHICULO".to_string()),
            vehicle_folder_path: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            vehicle_name: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
            plate: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
            supplier_name: row.get(5)?,
            purchase_date: row.get(6)?,
            purchase_price: row.get(7)?,
            invoice_number: row.get::<_, Option<String>>(8)?.unwrap_or_default(),
            payment_method: row.get::<_, Option<String>>(9)?.unwrap_or_default(),
            notes: row.get::<_, Option<String>>(10)?.unwrap_or_default(),
            source_file: row.get::<_, Option<String>>(11)?.unwrap_or_default(),
            created_at: row.get(12)?,
        })
    })?;

    records.collect()
}

/// Add a purchase record
pub fn add_purchase_record(
    conn: &Connection,
    expense_type: &str,
    vehicle_folder_path: &str,
    vehicle_name: &str,
    plate: &str,
    supplier_name: &str,
    purchase_date: &str,
    purchase_price: f64,
    invoice_number: &str,
    payment_method: &str,
    notes: &str,
    source_file: &str,
) -> SqlResult<PurchaseRecord> {
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO purchase_records (expense_type, vehicle_folder_path, vehicle_name, plate, supplier_name, purchase_date, purchase_price, invoice_number, payment_method, notes, source_file, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            expense_type.to_string(),
            vehicle_folder_path.to_string(),
            vehicle_name.to_string(),
            plate.to_string(),
            supplier_name.to_string(),
            purchase_date.to_string(),
            purchase_price.to_string(),
            invoice_number.to_string(),
            payment_method.to_string(),
            notes.to_string(),
            source_file.to_string(),
            now.clone(),
        ],
    )?;

    let id: u64 = conn.last_insert_rowid() as u64;
    Ok(PurchaseRecord {
        id,
        expense_type: expense_type.to_string(),
        vehicle_folder_path: vehicle_folder_path.to_string(),
        vehicle_name: vehicle_name.to_string(),
        plate: plate.to_string(),
        supplier_name: supplier_name.to_string(),
        purchase_date: purchase_date.to_string(),
        purchase_price,
        invoice_number: invoice_number.to_string(),
        payment_method: payment_method.to_string(),
        notes: notes.to_string(),
        source_file: source_file.to_string(),
        created_at: now,
    })
}

/// Delete a purchase record
pub fn delete_purchase_record(conn: &Connection, record_id: u64) -> SqlResult<()> {
    conn.execute("DELETE FROM purchase_records WHERE id = ?", [record_id.to_string()])?;
    Ok(())
}

/// Authenticate a user by username and password.
/// Soporta PBKDF2 (nuevo) y SHA-256 legacy con migración gradual automática.
/// Usa una transacción para garantizar atomicidad de la migración de hash.
pub fn authenticate_user(conn: &Connection, username: &str, password: &str) -> SqlResult<Option<LoginResult>> {
    let tx = conn.unchecked_transaction()?;

    let user_row = tx.query_row(
        "SELECT id, company_id, full_name, username, password_hash, role, active, created_at
         FROM users WHERE username = ?",
        [username],
        |row| {
            Ok((
                row.get::<_, u64>(0)?,
                row.get::<_, u64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, bool>(6)?,
                row.get::<_, String>(7)?,
            ))
        },
    ).optional()?;

    let Some((id, company_id, full_name, uname, stored_hash, role, active, created_at)) = user_row else {
        return Ok(None);
    };

    if !active {
        return Ok(None);
    }

    // Verificar password (soporta PBKDF2 y SHA-256 legacy)
    let (valid, new_hash) = verify_password(password, &stored_hash);
    if !valid {
        return Ok(None);
    }

    // Si el hash era legacy SHA-256, migrar silenciosamente a PBKDF2
    if let Some(upgraded_hash) = new_hash {
        let _ = tx.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            rusqlite::params![upgraded_hash, id],
        );
    }

    let company = get_company(&tx, company_id)?;
    let Some(company) = company else {
        return Ok(None);
    };

    tx.commit()?;

    Ok(Some(LoginResult {
        user: User { id, company_id, full_name, username: uname, role, active, created_at },
        company,
    }))
}

/// Get a company by ID
pub fn get_company(conn: &Connection, id: u64) -> SqlResult<Option<Company>> {
    conn.query_row(
        "SELECT id, trade_name, legal_name, cif, address, phone, email, created_at
         FROM companies WHERE id = ?",
        [id],
        |row| {
            Ok(Company {
                id: row.get(0)?,
                trade_name: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                legal_name: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                cif: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                address: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                phone: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
                email: row.get::<_, Option<String>>(6)?.unwrap_or_default(),
                created_at: row.get(7)?,
            })
        },
    ).optional()
}
