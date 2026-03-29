use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use rusqlite::Connection;

mod db;
mod importer;
mod platform;

pub use db::{Company, LeadNote, LoginResult, PurchaseRecord, SalesRecord, User};
pub use importer::ImportReport;

const DATA_DIR: &str = "data";
const STOCK_DIR: &str = "stock";
const BACKUPS_DIR: &str = "backups";
const DB_FILE: &str = "app.db";
const LEADS_FILE: &str = "leads.json";
const CLIENTS_FILE: &str = "clients.json";
const VEHICLE_ADS_FILE: &str = "vehicle_ads.json";
const LEGACY_SALES_PARENT_FOLDERS: [&str; 2] = ["CODINACARS PC", "varios codinacars"];
const LEGACY_FISCAL_DIR_NAMES: [&str; 1] = ["FISCAL"];
const LEGACY_GASTOS_DIR_NAMES: [&str; 1] = ["GASTOS"];

#[derive(Debug, Serialize, Deserialize, Clone)]
struct StockVehicle {
    name: String,
    folder_path: String,
    ad_info: Option<VehicleAdInfo>,
    #[serde(default)]
    precio_compra: Option<f64>,
    #[serde(default)]
    precio_venta: Option<f64>,
    #[serde(default)]
    km: Option<u32>,
    #[serde(default)]
    anio: Option<u16>,
    #[serde(default)]
    estado: String, // "disponible", "reservado", "vendido"
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
struct VehicleAdInfo {
    url: String,
    status: String,
    date: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Lead {
    id: u64,
    name: String,
    phone: String,
    email: String,
    notes: String,
    vehicle_interest: String,
    vehicle_folder_path: Option<String>,
    converted_client_id: Option<u64>,
    #[serde(default)]
    estado: String, // "nuevo", "contactado", "negociando", "cerrado", "perdido"
    #[serde(default)]
    fecha_contacto: Option<String>,
    #[serde(default)]
    canal: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Client {
    id: u64,
    name: String,
    phone: String,
    email: String,
    dni: String,
    notes: String,
    vehicle_folder_path: Option<String>,
    source_lead_id: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct SalesFolderNode {
    name: String,
    folder_path: String,
    children: Vec<SalesFolderNode>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct LegacyEntryNode {
    name: String,
    entry_path: String,
    open_path: String,
    is_dir: bool,
    children: Vec<LegacyEntryNode>,
}

#[derive(Debug, Serialize)]
struct AppStatePayload {
    stock_folder: String,
    stock: Vec<StockVehicle>,
    leads: Vec<Lead>,
    clients: Vec<Client>,
    sales_root: Option<String>,
    sales_history: Vec<SalesFolderNode>,
    sales_message: Option<String>,
    fiscal_root: Option<String>,
    fiscal_entries: Vec<LegacyEntryNode>,
    fiscal_message: Option<String>,
    gastos_root: Option<String>,
    gastos_entries: Vec<LegacyEntryNode>,
    gastos_message: Option<String>,
}

#[derive(Debug, Serialize)]
struct ExportManifest {
    exported_at: String,
    app_version: String,
    included_files: Vec<String>,
}

#[derive(Debug, Serialize)]
struct ExportDataPayload {
    export_path: String,
    included_files: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct LeadInput {
    name: String,
    phone: String,
    email: String,
    notes: String,
    vehicle_interest: String,
    vehicle_folder_path: Option<String>,
    #[serde(default)]
    estado: Option<String>,
    #[serde(default)]
    fecha_contacto: Option<String>,
    #[serde(default)]
    canal: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClientInput {
    name: String,
    phone: String,
    email: String,
    dni: String,
    notes: String,
    vehicle_folder_path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct VehicleAdInput {
    url: String,
    status: String,
    date: String,
}

pub(crate) fn stock_vehicle_from_path(path: &Path) -> Result<StockVehicle, String> {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            format!(
                "No se pudo obtener el nombre de la carpeta {}",
                path.display()
            )
        })?;

    Ok(StockVehicle {
        name,
        folder_path: path.to_string_lossy().to_string(),
        ad_info: None,
        precio_compra: None,
        precio_venta: None,
        km: None,
        anio: None,
        estado: "disponible".to_string(),
    })
}

fn ensure_database_migrated(app: &AppHandle) -> Result<(), String> {
    let db_path = db_path(app)?;
    let data_dir = app_data_root_dir(app)?;

    // Si la base de datos ya existe, no hacer nada
    if db_path.exists() {
        return Ok(());
    }

    // Crear e inicializar la base de datos
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("No se pudo crear la base de datos: {}", e))?;

    db::init_db(&conn)
        .map_err(|e| format!("No se pudo inicializar la base de datos: {}", e))?;

    // Migrar datos de JSON si existen
    let leads_file = data_dir.join(LEADS_FILE);
    let clients_file = data_dir.join(CLIENTS_FILE);

    if leads_file.exists() || clients_file.exists() {
        // Leer leads
        let leads: Vec<Lead> = if leads_file.exists() {
            read_collection::<Lead>(&leads_file)?
        } else {
            Vec::new()
        };

        // Leer clients
        let clients: Vec<Client> = if clients_file.exists() {
            read_collection::<Client>(&clients_file)?
        } else {
            Vec::new()
        };

        let leads_count = leads.len();
        let clients_count = clients.len();

        // Insertar en SQLite (mantener IDs originales)
        for lead in leads {
            let _ = db::save_lead(&conn, &lead);
        }

        for client in clients {
            let _ = db::save_client(&conn, &client);
        }

        println!("Migración de datos completada: {} leads, {} clients", leads_count, clients_count);
    }

    Ok(())
}

fn app_data_root_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("No se pudo obtener el directorio de datos: {error}"))?;

    let data_dir = app_data_dir.join(DATA_DIR);
    fs::create_dir_all(&data_dir).map_err(|error| {
        format!(
            "No se pudo crear la carpeta de datos {}: {error}",
            data_dir.display()
        )
    })?;

    Ok(data_dir)
}

fn project_root_dir() -> Result<PathBuf, String> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .and_then(Path::parent)
        .map(Path::to_path_buf)
        .ok_or_else(|| "No se pudo resolver la raíz del proyecto.".to_string())
}

fn docs_legacy_dir() -> Result<PathBuf, String> {
    Ok(project_root_dir()?.join("docs_legacy"))
}

fn app_stock_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let stock_dir = app_data_root_dir(app)?.join(STOCK_DIR);
    fs::create_dir_all(&stock_dir)
        .map_err(|error| format!("No se pudo crear la carpeta de stock: {error}"))?;

    Ok(stock_dir)
}

fn canonical_stock_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let stock_dir = app_stock_dir(app)?;
    stock_dir.canonicalize().map_err(|error| {
        format!(
            "No se pudo resolver la carpeta de stock {}: {error}",
            stock_dir.display()
        )
    })
}

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_root_dir(app)?.join(DB_FILE))
}

fn get_db_connection(app: &AppHandle) -> Result<Connection, String> {
    let db_file = db_path(app)?;
    let conn = Connection::open(&db_file)
        .map_err(|error| format!("No se pudo abrir la base de datos: {error}"))?;
    db::init_db(&conn)
        .map_err(|error| format!("No se pudo inicializar la base de datos: {error}"))?;
    Ok(conn)
}

fn leads_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_root_dir(app)?.join(LEADS_FILE))
}

fn clients_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_root_dir(app)?.join(CLIENTS_FILE))
}

fn vehicle_ads_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_root_dir(app)?.join(VEHICLE_ADS_FILE))
}

fn backups_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let backups_dir = app_data_root_dir(app)?.join(BACKUPS_DIR);
    fs::create_dir_all(&backups_dir).map_err(|error| {
        format!(
            "No se pudo crear la carpeta de copias {}: {error}",
            backups_dir.display()
        )
    })?;
    Ok(backups_dir)
}

pub(crate) fn sanitize_vehicle_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("El nombre del vehículo no puede estar vacío.".to_string());
    }

    let replaced: String = trimmed
        .chars()
        .map(|character| match character {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => ' ',
            _ if character.is_control() => ' ',
            _ => character,
        })
        .collect();

    let collapsed = replaced.split_whitespace().collect::<Vec<_>>().join(" ");
    let limited: String = collapsed.chars().take(80).collect();
    let sanitized = limited.trim_matches(|character| character == ' ' || character == '.');

    if sanitized.is_empty() {
        return Err("El nombre del vehículo no es válido.".to_string());
    }

    Ok(sanitized.to_string())
}

pub(crate) fn ensure_unique_vehicle_path(
    stock_dir: &Path,
    base_name: &str,
    current_path: Option<&Path>,
) -> Result<PathBuf, String> {
    let current_path = current_path.map(|path| {
        path.canonicalize().map_err(|error| {
            format!(
                "No se pudo validar la carpeta actual {}: {error}",
                path.display()
            )
        })
    });
    let current_path = match current_path {
        Some(result) => Some(result?),
        None => None,
    };

    for suffix in 0..10_000 {
        let candidate_name = if suffix == 0 {
            base_name.to_string()
        } else {
            format!("{base_name} ({})", suffix + 1)
        };
        let candidate_path = stock_dir.join(&candidate_name);

        if !candidate_path.exists() {
            return Ok(candidate_path);
        }

        if let Some(current_path) = &current_path {
            let canonical_candidate = candidate_path.canonicalize().map_err(|error| {
                format!(
                    "No se pudo validar si la carpeta {} ya existe: {error}",
                    candidate_path.display()
                )
            })?;
            if canonical_candidate == *current_path {
                return Ok(candidate_path);
            }
        }
    }

    Err("No se pudo generar un nombre de carpeta único para el vehículo.".to_string())
}

pub(crate) fn sanitize_contact_name(name: &str) -> Result<String, String> {
    let sanitized = name.split_whitespace().collect::<Vec<_>>().join(" ");
    if sanitized.is_empty() {
        return Err("El nombre no puede estar vacío.".to_string());
    }

    Ok(sanitized)
}

fn sanitize_text_field(value: &str) -> String {
    value
        .lines()
        .map(str::trim)
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

fn sanitize_optional_path(value: Option<String>) -> Option<String> {
    value
        .map(|current| sanitize_text_field(&current))
        .filter(|current| !current.is_empty())
}

fn next_record_id<T, F>(items: &[T], id_for: F) -> u64
where
    F: Fn(&T) -> u64,
{
    items.iter().map(id_for).max().unwrap_or(0) + 1
}

fn build_lead(id: u64, input: LeadInput, converted_client_id: Option<u64>) -> Result<Lead, String> {
    Ok(Lead {
        id,
        name: sanitize_contact_name(&input.name)?,
        phone: sanitize_text_field(&input.phone),
        email: sanitize_text_field(&input.email),
        notes: sanitize_text_field(&input.notes),
        vehicle_interest: sanitize_text_field(&input.vehicle_interest),
        vehicle_folder_path: sanitize_optional_path(input.vehicle_folder_path),
        converted_client_id,
        estado: input.estado.unwrap_or_else(|| "nuevo".to_string()),
        fecha_contacto: input.fecha_contacto,
        canal: input.canal,
    })
}

fn build_client(
    id: u64,
    input: ClientInput,
    source_lead_id: Option<u64>,
) -> Result<Client, String> {
    Ok(Client {
        id,
        name: sanitize_contact_name(&input.name)?,
        phone: sanitize_text_field(&input.phone),
        email: sanitize_text_field(&input.email),
        dni: sanitize_text_field(&input.dni),
        notes: sanitize_text_field(&input.notes),
        vehicle_folder_path: sanitize_optional_path(input.vehicle_folder_path),
        source_lead_id,
    })
}

fn read_collection<T>(path: &Path) -> Result<Vec<T>, String>
where
    T: DeserializeOwned,
{
    if !path.exists() {
        return Ok(Vec::new());
    }

    let contents = fs::read_to_string(path)
        .map_err(|error| format!("No se pudo leer {}: {error}", path.display()))?;

    if contents.trim().is_empty() {
        return Ok(Vec::new());
    }

    serde_json::from_str(&contents)
        .map_err(|error| format!("No se pudo interpretar {}: {error}", path.display()))
}

fn write_collection<T>(path: &Path, items: &[T]) -> Result<(), String>
where
    T: Serialize,
{
    let contents = serde_json::to_string_pretty(items)
        .map_err(|error| format!("No se pudo serializar {}: {error}", path.display()))?;

    fs::write(path, contents)
        .map_err(|error| format!("No se pudo guardar {}: {error}", path.display()))
}

fn write_json_value(path: &Path, value: &impl Serialize) -> Result<(), String> {
    let contents = serde_json::to_string_pretty(value)
        .map_err(|error| format!("No se pudo serializar {}: {error}", path.display()))?;
    fs::write(path, contents)
        .map_err(|error| format!("No se pudo guardar {}: {error}", path.display()))
}

fn backup_timestamp_token(now: SystemTime) -> Result<String, String> {
    let duration = now
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("No se pudo calcular la fecha de exportación: {error}"))?;
    Ok(duration.as_millis().to_string())
}

fn write_backup_bundle(
    source_data_dir: &Path,
    backups_dir: &Path,
    app_version: &str,
    exported_at: &str,
) -> Result<ExportDataPayload, String> {
    let export_dir = backups_dir.join(format!("backup-{exported_at}"));
    fs::create_dir_all(&export_dir).map_err(|error| {
        format!(
            "No se pudo crear la carpeta de exportación {}: {error}",
            export_dir.display()
        )
    })?;

    let included_files = vec![
        LEADS_FILE.to_string(),
        CLIENTS_FILE.to_string(),
        VEHICLE_ADS_FILE.to_string(),
        "manifest.json".to_string(),
    ];

    for file_name in [LEADS_FILE, CLIENTS_FILE, VEHICLE_ADS_FILE] {
        let source_path = source_data_dir.join(file_name);
        let target_path = export_dir.join(file_name);

        if source_path.exists() {
            fs::copy(&source_path, &target_path).map_err(|error| {
                format!(
                    "No se pudo copiar {} a {}: {error}",
                    source_path.display(),
                    target_path.display()
                )
            })?;
        } else {
            write_json_value(&target_path, &Vec::<serde_json::Value>::new())?;
        }
    }

    let manifest = ExportManifest {
        exported_at: exported_at.to_string(),
        app_version: app_version.to_string(),
        included_files: included_files.clone(),
    };
    write_json_value(&export_dir.join("manifest.json"), &manifest)?;

    Ok(ExportDataPayload {
        export_path: export_dir.to_string_lossy().to_string(),
        included_files,
    })
}

fn list_leads_internal(app: &AppHandle) -> Result<Vec<Lead>, String> {
    // Asegurar que la base de datos está migrada
    ensure_database_migrated(app)?;

    // Leer de SQLite
    let conn = get_db_connection(app)?;
    let mut leads = db::load_leads(&conn)
        .map_err(|e| format!("Error al cargar leads: {}", e))?;
    leads.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok(leads)
}

fn list_clients_internal(app: &AppHandle) -> Result<Vec<Client>, String> {
    // Asegurar que la base de datos está migrada
    ensure_database_migrated(app)?;

    // Leer de SQLite
    let conn = get_db_connection(app)?;
    let mut clients = db::load_clients(&conn)
        .map_err(|e| format!("Error al cargar clients: {}", e))?;
    clients.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok(clients)
}

fn save_leads(app: &AppHandle, leads: &[Lead]) -> Result<(), String> {
    // Guardar en SQLite
    let conn = get_db_connection(app)?;
    for lead in leads {
        db::save_lead(&conn, lead)
            .map_err(|e| format!("Error al guardar lead: {}", e))?;
    }
    Ok(())
}

fn save_clients(app: &AppHandle, clients: &[Client]) -> Result<(), String> {
    // Guardar en SQLite
    let conn = get_db_connection(app)?;
    for client in clients {
        db::save_client(&conn, client)
            .map_err(|e| format!("Error al guardar client: {}", e))?;
    }
    Ok(())
}

fn read_vehicle_ads_map(
    app: &AppHandle,
) -> Result<std::collections::BTreeMap<String, VehicleAdInfo>, String> {
    let items = read_collection::<(String, VehicleAdInfo)>(&vehicle_ads_file_path(app)?)?;
    Ok(items.into_iter().collect())
}

fn save_vehicle_ads_map(
    app: &AppHandle,
    map: &std::collections::BTreeMap<String, VehicleAdInfo>,
) -> Result<(), String> {
    let items = map
        .iter()
        .map(|(key, value)| (key.clone(), value.clone()))
        .collect::<Vec<_>>();
    write_collection(&vehicle_ads_file_path(app)?, &items)
}

fn validate_optional_vehicle_folder_path(
    app: &AppHandle,
    vehicle_folder_path: Option<String>,
) -> Result<Option<String>, String> {
    let Some(vehicle_folder_path) = sanitize_optional_path(vehicle_folder_path) else {
        return Ok(None);
    };
    let validated = validate_vehicle_folder(app, &vehicle_folder_path)?;
    Ok(Some(validated.to_string_lossy().to_string()))
}

fn rewrite_vehicle_reference_in_contacts(
    app: &AppHandle,
    old_path: &str,
    new_path: Option<&str>,
) -> Result<(), String> {
    let mut leads = read_collection::<Lead>(&leads_file_path(app)?)?;
    let mut clients = read_collection::<Client>(&clients_file_path(app)?)?;

    for lead in &mut leads {
        if lead.vehicle_folder_path.as_deref() == Some(old_path) {
            lead.vehicle_folder_path = new_path.map(ToOwned::to_owned);
        }
    }

    for client in &mut clients {
        if client.vehicle_folder_path.as_deref() == Some(old_path) {
            client.vehicle_folder_path = new_path.map(ToOwned::to_owned);
        }
    }

    save_leads(app, &leads)?;
    save_clients(app, &clients)
}

fn validate_vehicle_folder(app: &AppHandle, folder_path: &str) -> Result<PathBuf, String> {
    let stock_dir = canonical_stock_dir(app)?;
    let vehicle_path = PathBuf::from(folder_path);
    let canonical_vehicle = vehicle_path.canonicalize().map_err(|error| {
        format!(
            "No se pudo resolver la carpeta indicada {}: {error}",
            vehicle_path.display()
        )
    })?;

    if !canonical_vehicle.starts_with(&stock_dir) {
        return Err("La carpeta indicada no pertenece al stock de la aplicación.".to_string());
    }

    if !canonical_vehicle.is_dir() {
        return Err("La carpeta indicada no es un directorio válido.".to_string());
    }

    Ok(canonical_vehicle)
}

pub(crate) fn folder_node_from_path(
    path: &Path,
    depth_remaining: usize,
) -> Result<SalesFolderNode, String> {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            format!(
                "No se pudo obtener el nombre de la carpeta {}",
                path.display()
            )
        })?;

    let mut children = Vec::new();
    if depth_remaining > 0 {
        let entries = fs::read_dir(path)
            .map_err(|error| format!("No se pudo leer la carpeta {}: {error}", path.display()))?;

        for entry in entries.flatten() {
            let child_path = entry.path();
            if child_path.is_dir() {
                children.push(folder_node_from_path(&child_path, depth_remaining - 1)?);
            }
        }
        children.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    }

    Ok(SalesFolderNode {
        name,
        folder_path: path.to_string_lossy().to_string(),
        children,
    })
}

pub(crate) fn sales_parent_dirs_from_docs_legacy(docs_legacy: &Path) -> Vec<PathBuf> {
    LEGACY_SALES_PARENT_FOLDERS
        .iter()
        .map(|segment| docs_legacy.join(segment))
        .filter(|path| path.is_dir())
        .collect()
}

pub(crate) fn legacy_dir_from_docs_legacy(
    docs_legacy: &Path,
    expected_names: &[&str],
) -> Option<PathBuf> {
    let entries = fs::read_dir(docs_legacy).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if expected_names
            .iter()
            .any(|expected| name.eq_ignore_ascii_case(expected))
        {
            return Some(path);
        }
    }

    None
}

pub(crate) fn legacy_entry_node_from_path(
    path: &Path,
    depth_remaining: usize,
) -> Result<LegacyEntryNode, String> {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            format!(
                "No se pudo obtener el nombre del elemento {}",
                path.display()
            )
        })?;

    let is_dir = path.is_dir();
    let open_path = if is_dir {
        path.to_path_buf()
    } else {
        path.parent().unwrap_or(path).to_path_buf()
    };

    let mut children = Vec::new();
    if is_dir && depth_remaining > 0 {
        let entries = fs::read_dir(path)
            .map_err(|error| format!("No se pudo leer la carpeta {}: {error}", path.display()))?;

        for entry in entries.flatten() {
            let child_path = entry.path();
            if child_path.is_dir() {
                children.push(legacy_entry_node_from_path(
                    &child_path,
                    depth_remaining - 1,
                )?);
            }
        }
        children.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    }

    Ok(LegacyEntryNode {
        name,
        entry_path: path.to_string_lossy().to_string(),
        open_path: open_path.to_string_lossy().to_string(),
        is_dir,
        children,
    })
}

fn list_sales_history_nodes(
) -> Result<(Option<String>, Vec<SalesFolderNode>, Option<String>), String> {
    let docs_legacy = docs_legacy_dir()?;
    if !docs_legacy.is_dir() {
        return Ok((
            None,
            Vec::new(),
            Some("La carpeta docs_legacy no está disponible en la raíz del proyecto.".to_string()),
        ));
    }

    let parent_dirs = sales_parent_dirs_from_docs_legacy(&docs_legacy);
    if parent_dirs.is_empty() {
        return Ok((
            Some(docs_legacy.to_string_lossy().to_string()),
            Vec::new(),
            Some("No se encontraron contenedores de ventas en docs_legacy.".to_string()),
        ));
    }

    let mut sales_history = Vec::new();
    for parent_dir in &parent_dirs {
        let entries = fs::read_dir(parent_dir)
            .map_err(|error| format!("No se pudo leer {}: {error}", parent_dir.display()))?;

        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
                continue;
            };
            if !name.to_uppercase().starts_with("VENTAS") {
                continue;
            }

            sales_history.push(folder_node_from_path(&path, 2)?);
        }
    }

    sales_history.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));

    let sales_message = if sales_history.is_empty() {
        Some("No se encontraron carpetas de ventas históricas en docs_legacy.".to_string())
    } else {
        None
    };

    Ok((
        Some(docs_legacy.to_string_lossy().to_string()),
        sales_history,
        sales_message,
    ))
}

fn list_legacy_area_nodes(
    dir_names: &[&str],
    empty_message: &str,
) -> Result<(Option<String>, Vec<LegacyEntryNode>, Option<String>), String> {
    let docs_legacy = docs_legacy_dir()?;
    if !docs_legacy.is_dir() {
        return Ok((
            None,
            Vec::new(),
            Some("La carpeta docs_legacy no está disponible en la raíz del proyecto.".to_string()),
        ));
    }

    let Some(area_dir) = legacy_dir_from_docs_legacy(&docs_legacy, dir_names) else {
        return Ok((
            Some(docs_legacy.to_string_lossy().to_string()),
            Vec::new(),
            Some(empty_message.to_string()),
        ));
    };

    let mut entries = Vec::new();
    let area_contents = fs::read_dir(&area_dir)
        .map_err(|error| format!("No se pudo leer {}: {error}", area_dir.display()))?;

    for entry in area_contents.flatten() {
        let path = entry.path();
        if path.is_dir() {
            entries.push(legacy_entry_node_from_path(&path, 2)?);
            continue;
        }

        entries.push(legacy_entry_node_from_path(&path, 0)?);
    }

    entries.sort_by(|left, right| {
        right
            .is_dir
            .cmp(&left.is_dir)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });

    let message = if entries.is_empty() {
        Some(empty_message.to_string())
    } else {
        None
    };

    Ok((
        Some(area_dir.to_string_lossy().to_string()),
        entries,
        message,
    ))
}

fn list_stock(app: &AppHandle) -> Result<(String, Vec<StockVehicle>), String> {
    let stock_dir = app_stock_dir(app)?;
    let vehicle_ads = read_vehicle_ads_map(app)?;

    // Load DB data to merge with filesystem
    let conn = get_db_connection(app)?;
    let db_vehicles = db::load_vehicles(&conn)
        .map_err(|e| format!("Error al cargar vehiculos de BD: {}", e))?;
    let db_map: std::collections::HashMap<String, StockVehicle> = db_vehicles
        .into_iter()
        .map(|v| (v.folder_path.clone(), v))
        .collect();

    let mut vehicles = Vec::new();

    if let Ok(entries) = fs::read_dir(&stock_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let folder_path = path.to_string_lossy().to_string();
                if let Some(db_vehicle) = db_map.get(&folder_path) {
                    // Use DB data (has precio, km, anio, estado) merged with ad info
                    let mut vehicle = db_vehicle.clone();
                    if vehicle.ad_info.is_none() {
                        vehicle.ad_info = vehicle_ads.get(&folder_path).cloned();
                    }
                    // Only show if not vendido
                    if vehicle.estado != "vendido" {
                        vehicles.push(vehicle);
                    }
                } else {
                    // Folder exists but not in DB — create from path
                    let mut vehicle = stock_vehicle_from_path(&path)?;
                    vehicle.ad_info = vehicle_ads.get(&vehicle.folder_path).cloned();
                    vehicles.push(vehicle);
                }
            }
        }
    }

    vehicles.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));

    Ok((stock_dir.to_string_lossy().to_string(), vehicles))
}

fn first_jpeg_in_dir(dir: &Path) -> Result<Option<PathBuf>, String> {
    let mut dirs = vec![dir.to_path_buf()];

    while let Some(current_dir) = dirs.pop() {
        let mut child_dirs = Vec::new();
        let mut image_files = Vec::new();
        let entries = fs::read_dir(&current_dir).map_err(|error| {
            format!(
                "No se pudo leer la carpeta {}: {error}",
                current_dir.display()
            )
        })?;

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                child_dirs.push(path);
                continue;
            }

            let extension = path.extension().and_then(|value| value.to_str());
            if matches!(
                extension,
                Some("jpg") | Some("jpeg") | Some("JPG") | Some("JPEG")
            ) {
                image_files.push(path);
            }
        }

        child_dirs.sort();
        dirs.extend(child_dirs.into_iter().rev());

        image_files.sort();
        if let Some(first_image) = image_files.into_iter().next() {
            return Ok(Some(first_image));
        }
    }

    Ok(None)
}

#[tauri::command]
fn load_app_state(app: AppHandle) -> Result<AppStatePayload, String> {
    let (stock_folder, stock) = list_stock(&app)?;
    let leads = list_leads_internal(&app)?;
    let clients = list_clients_internal(&app)?;
    let (sales_root, sales_history, sales_message) = list_sales_history_nodes()?;
    let (fiscal_root, fiscal_entries, fiscal_message) = list_legacy_area_nodes(
        &LEGACY_FISCAL_DIR_NAMES,
        "No se encontraron carpetas o archivos fiscales en docs_legacy.",
    )?;
    let (gastos_root, gastos_entries, gastos_message) = list_legacy_area_nodes(
        &LEGACY_GASTOS_DIR_NAMES,
        "No se encontraron carpetas o archivos de gastos en docs_legacy.",
    )?;

    Ok(AppStatePayload {
        stock_folder,
        stock,
        leads,
        clients,
        sales_root,
        sales_history,
        sales_message,
        fiscal_root,
        fiscal_entries,
        fiscal_message,
        gastos_root,
        gastos_entries,
        gastos_message,
    })
}

#[tauri::command]
fn list_sales_history() -> Result<Vec<SalesFolderNode>, String> {
    list_sales_history_nodes().map(|(_, sales_history, _)| sales_history)
}

#[tauri::command]
fn list_fiscal_entries() -> Result<Vec<LegacyEntryNode>, String> {
    list_legacy_area_nodes(
        &LEGACY_FISCAL_DIR_NAMES,
        "No se encontraron carpetas o archivos fiscales en docs_legacy.",
    )
    .map(|(_, entries, _)| entries)
}

#[tauri::command]
fn list_gastos_entries() -> Result<Vec<LegacyEntryNode>, String> {
    list_legacy_area_nodes(
        &LEGACY_GASTOS_DIR_NAMES,
        "No se encontraron carpetas o archivos de gastos en docs_legacy.",
    )
    .map(|(_, entries, _)| entries)
}

#[tauri::command]
fn list_leads(app: AppHandle) -> Result<Vec<Lead>, String> {
    list_leads_internal(&app)
}

#[tauri::command]
fn list_clients(app: AppHandle) -> Result<Vec<Client>, String> {
    list_clients_internal(&app)
}

#[tauri::command]
fn get_vehicle_ad(app: AppHandle, folder_path: String) -> Result<Option<VehicleAdInfo>, String> {
    get_vehicle_ad_for_path(&app, &folder_path)
}

fn get_vehicle_ad_for_path(
    app: &AppHandle,
    folder_path: &str,
) -> Result<Option<VehicleAdInfo>, String> {
    let vehicle_folder = validate_vehicle_folder(app, folder_path)?;
    let ads = read_vehicle_ads_map(app)?;
    Ok(ads
        .get(&vehicle_folder.to_string_lossy().to_string())
        .cloned())
}

#[tauri::command]
fn get_stock_folder_path(app: AppHandle) -> Result<String, String> {
    app_stock_dir(&app).map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
fn create_vehicle(app: AppHandle, name: String) -> Result<StockVehicle, String> {
    let stock_dir = app_stock_dir(&app)?;
    let sanitized_name = sanitize_vehicle_name(&name)?;
    let vehicle_path = ensure_unique_vehicle_path(&stock_dir, &sanitized_name, None)?;

    fs::create_dir_all(&vehicle_path).map_err(|error| {
        format!(
            "No se pudo crear la carpeta {}: {error}",
            vehicle_path.display()
        )
    })?;

    stock_vehicle_from_path(&vehicle_path)
}

#[tauri::command]
fn rename_vehicle(
    app: AppHandle,
    folder_path: String,
    new_name: String,
) -> Result<StockVehicle, String> {
    let stock_dir = canonical_stock_dir(&app)?;
    let current_folder = validate_vehicle_folder(&app, &folder_path)?;
    let current_folder_string = current_folder.to_string_lossy().to_string();
    let sanitized_name = sanitize_vehicle_name(&new_name)?;
    let target_path =
        ensure_unique_vehicle_path(&stock_dir, &sanitized_name, Some(&current_folder))?;

    if target_path != current_folder {
        fs::rename(&current_folder, &target_path).map_err(|error| {
            format!(
                "No se pudo renombrar la carpeta {} a {}: {error}",
                current_folder.display(),
                target_path.display()
            )
        })?;

        let mut ads = read_vehicle_ads_map(&app)?;
        if let Some(ad_info) = ads.remove(&current_folder_string) {
            ads.insert(target_path.to_string_lossy().to_string(), ad_info);
            save_vehicle_ads_map(&app, &ads)?;
        }
        rewrite_vehicle_reference_in_contacts(
            &app,
            &current_folder_string,
            Some(&target_path.to_string_lossy()),
        )?;
    }

    let mut vehicle = stock_vehicle_from_path(&target_path)?;
    vehicle.ad_info = get_vehicle_ad_for_path(&app, &vehicle.folder_path)?;
    Ok(vehicle)
}

#[tauri::command]
fn delete_vehicle(app: AppHandle, folder_path: String) -> Result<(), String> {
    let current_folder = validate_vehicle_folder(&app, &folder_path)?;
    let current_folder_string = current_folder.to_string_lossy().to_string();
    fs::remove_dir_all(&current_folder).map_err(|error| {
        format!(
            "No se pudo eliminar la carpeta {}: {error}",
            current_folder.display()
        )
    })?;

    let mut ads = read_vehicle_ads_map(&app)?;
    if ads.remove(&current_folder_string).is_some() {
        save_vehicle_ads_map(&app, &ads)?;
    }
    rewrite_vehicle_reference_in_contacts(&app, &current_folder_string, None)
}

#[tauri::command]
fn create_lead(app: AppHandle, input: LeadInput) -> Result<Lead, String> {
    let mut leads = read_collection::<Lead>(&leads_file_path(&app)?)?;
    let next_id = next_record_id(&leads, |lead| lead.id);
    let vehicle_folder_path =
        validate_optional_vehicle_folder_path(&app, input.vehicle_folder_path.clone())?;
    let lead = build_lead(
        next_id,
        LeadInput {
            vehicle_folder_path,
            ..input
        },
        None,
    )?;
    leads.push(lead.clone());
    save_leads(&app, &leads)?;
    Ok(lead)
}

#[tauri::command]
fn update_lead(app: AppHandle, id: u64, input: LeadInput) -> Result<Lead, String> {
    let mut leads = read_collection::<Lead>(&leads_file_path(&app)?)?;
    let index = leads
        .iter()
        .position(|lead| lead.id == id)
        .ok_or_else(|| format!("No existe el lead con id {id}."))?;
    let converted_client_id = leads[index].converted_client_id;
    let vehicle_folder_path =
        validate_optional_vehicle_folder_path(&app, input.vehicle_folder_path.clone())?;
    let updated = build_lead(
        id,
        LeadInput {
            vehicle_folder_path,
            ..input
        },
        converted_client_id,
    )?;
    leads[index] = updated.clone();
    save_leads(&app, &leads)?;
    Ok(updated)
}

#[tauri::command]
fn delete_lead(app: AppHandle, id: u64) -> Result<(), String> {
    let mut leads = read_collection::<Lead>(&leads_file_path(&app)?)?;
    let previous_len = leads.len();
    leads.retain(|lead| lead.id != id);
    if leads.len() == previous_len {
        return Err(format!("No existe el lead con id {id}."));
    }

    let mut clients = read_collection::<Client>(&clients_file_path(&app)?)?;
    for client in &mut clients {
        if client.source_lead_id == Some(id) {
            client.source_lead_id = None;
        }
    }

    save_leads(&app, &leads)?;
    save_clients(&app, &clients)
}

#[tauri::command]
fn create_client(app: AppHandle, input: ClientInput) -> Result<Client, String> {
    let mut clients = read_collection::<Client>(&clients_file_path(&app)?)?;
    let next_id = next_record_id(&clients, |client| client.id);
    let vehicle_folder_path =
        validate_optional_vehicle_folder_path(&app, input.vehicle_folder_path.clone())?;
    let client = build_client(
        next_id,
        ClientInput {
            vehicle_folder_path,
            ..input
        },
        None,
    )?;
    clients.push(client.clone());
    save_clients(&app, &clients)?;
    Ok(client)
}

#[tauri::command]
fn update_client(app: AppHandle, id: u64, input: ClientInput) -> Result<Client, String> {
    let mut clients = read_collection::<Client>(&clients_file_path(&app)?)?;
    let index = clients
        .iter()
        .position(|client| client.id == id)
        .ok_or_else(|| format!("No existe el cliente con id {id}."))?;
    let source_lead_id = clients[index].source_lead_id;
    let vehicle_folder_path =
        validate_optional_vehicle_folder_path(&app, input.vehicle_folder_path.clone())?;
    let updated = build_client(
        id,
        ClientInput {
            vehicle_folder_path,
            ..input
        },
        source_lead_id,
    )?;
    clients[index] = updated.clone();
    save_clients(&app, &clients)?;
    Ok(updated)
}

#[tauri::command]
fn delete_client(app: AppHandle, id: u64) -> Result<(), String> {
    let mut clients = read_collection::<Client>(&clients_file_path(&app)?)?;
    let previous_len = clients.len();
    clients.retain(|client| client.id != id);
    if clients.len() == previous_len {
        return Err(format!("No existe el cliente con id {id}."));
    }

    let mut leads = read_collection::<Lead>(&leads_file_path(&app)?)?;
    for lead in &mut leads {
        if lead.converted_client_id == Some(id) {
            lead.converted_client_id = None;
        }
    }

    save_clients(&app, &clients)?;
    save_leads(&app, &leads)
}

#[tauri::command]
fn convert_lead_to_client(
    app: AppHandle,
    lead_id: u64,
    input: ClientInput,
) -> Result<Client, String> {
    let mut leads = read_collection::<Lead>(&leads_file_path(&app)?)?;
    let lead_index = leads
        .iter()
        .position(|lead| lead.id == lead_id)
        .ok_or_else(|| format!("No existe el lead con id {lead_id}."))?;

    let mut clients = read_collection::<Client>(&clients_file_path(&app)?)?;
    let next_id = next_record_id(&clients, |client| client.id);
    let vehicle_folder_path =
        validate_optional_vehicle_folder_path(&app, input.vehicle_folder_path.clone())?;
    let client = build_client(
        next_id,
        ClientInput {
            vehicle_folder_path,
            ..input
        },
        Some(lead_id),
    )?;

    clients.push(client.clone());
    leads[lead_index].converted_client_id = Some(client.id);

    save_clients(&app, &clients)?;
    save_leads(&app, &leads)?;

    Ok(client)
}

#[tauri::command]
fn set_vehicle_ad(
    app: AppHandle,
    folder_path: String,
    input: VehicleAdInput,
) -> Result<Option<VehicleAdInfo>, String> {
    let vehicle_folder = validate_vehicle_folder(&app, &folder_path)?;
    let vehicle_folder = vehicle_folder.to_string_lossy().to_string();
    let mut ads = read_vehicle_ads_map(&app)?;

    let ad_info = VehicleAdInfo {
        url: sanitize_text_field(&input.url),
        status: sanitize_text_field(&input.status),
        date: sanitize_text_field(&input.date),
    };

    if ad_info.url.is_empty() && ad_info.status.is_empty() && ad_info.date.is_empty() {
        ads.remove(&vehicle_folder);
        save_vehicle_ads_map(&app, &ads)?;
        return Ok(None);
    }

    ads.insert(vehicle_folder, ad_info.clone());
    save_vehicle_ads_map(&app, &ads)?;
    Ok(Some(ad_info))
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    let folder = PathBuf::from(&path);
    if !folder.exists() || !folder.is_dir() {
        return Err("La carpeta indicada no existe.".to_string());
    }

    #[cfg(target_os = "windows")]
    let result = Command::new("explorer").arg(&path).spawn();

    #[cfg(target_os = "macos")]
    let result = Command::new("open").arg(&path).spawn();

    #[cfg(all(unix, not(target_os = "macos")))]
    let result = Command::new("xdg-open").arg(&path).spawn();

    result
        .map(|_| ())
        .map_err(|error| format!("No se pudo abrir la carpeta: {error}"))
}

#[tauri::command]
fn open_external(target: String) -> Result<(), String> {
    let target = sanitize_text_field(&target);
    if target.is_empty() {
        return Err("No hay ningún enlace para abrir.".to_string());
    }

    #[cfg(target_os = "windows")]
    let result = Command::new("explorer").arg(&target).spawn();

    #[cfg(target_os = "macos")]
    let result = Command::new("open").arg(&target).spawn();

    #[cfg(all(unix, not(target_os = "macos")))]
    let result = Command::new("xdg-open").arg(&target).spawn();

    result
        .map(|_| ())
        .map_err(|error| format!("No se pudo abrir el enlace: {error}"))
}

#[tauri::command]
fn get_vehicle_thumbnail(app: AppHandle, folder_path: String) -> Result<Option<String>, String> {
    let folder = validate_vehicle_folder(&app, &folder_path)?;

    let Some(image_path) = first_jpeg_in_dir(&folder)? else {
        return Ok(None);
    };

    let image_bytes =
        fs::read(&image_path).map_err(|error| format!("No se pudo leer la imagen: {error}"))?;

    Ok(Some(format!(
        "data:image/jpeg;base64,{}",
        STANDARD.encode(image_bytes)
    )))
}

#[tauri::command]
fn export_app_data(app: AppHandle) -> Result<ExportDataPayload, String> {
    let data_dir = app_data_root_dir(&app)?;
    let backups_dir = backups_dir(&app)?;
    let exported_at = backup_timestamp_token(SystemTime::now())?;
    write_backup_bundle(
        &data_dir,
        &backups_dir,
        &app.package_info().version.to_string(),
        &exported_at,
    )
}

#[tauri::command]
fn get_lead_notes(app: AppHandle, lead_id: u64) -> Result<Vec<LeadNote>, String> {
    let conn = get_db_connection(&app)?;
    db::get_lead_notes(&conn, lead_id)
        .map_err(|error| format!("No se pudo cargar las notas del lead: {error}"))
}

#[tauri::command]
fn add_lead_note(app: AppHandle, lead_id: u64, content: String) -> Result<LeadNote, String> {
    let conn = get_db_connection(&app)?;
    db::add_lead_note(&conn, lead_id, &content)
        .map_err(|error| format!("No se pudo añadir la nota: {error}"))
}

#[tauri::command]
fn delete_lead_note(app: AppHandle, note_id: u64) -> Result<(), String> {
    let conn = get_db_connection(&app)?;
    db::delete_lead_note(&conn, note_id)
        .map_err(|error| format!("No se pudo eliminar la nota: {error}"))
}

#[tauri::command]
fn get_sales_records(app: AppHandle) -> Result<Vec<SalesRecord>, String> {
    let conn = get_db_connection(&app)?;
    db::get_sales_records(&conn)
        .map_err(|error| format!("No se pudo cargar los registros de venta: {error}"))
}

#[tauri::command]
fn add_sales_record(
    app: AppHandle,
    vehicle_folder_path: String,
    client_id: Option<u64>,
    lead_id: Option<u64>,
    price_final: f64,
    notes: String,
) -> Result<SalesRecord, String> {
    let conn = get_db_connection(&app)?;
    db::add_sales_record(&conn, &vehicle_folder_path, client_id, lead_id, price_final, &notes)
        .map_err(|error| format!("No se pudo registrar la venta: {error}"))
}

#[tauri::command]
fn delete_sales_record(app: AppHandle, record_id: u64) -> Result<(), String> {
    let conn = get_db_connection(&app)?;
    db::delete_sales_record(&conn, record_id)
        .map_err(|error| format!("No se pudo eliminar el registro de venta: {error}"))
}

#[tauri::command]
fn get_purchase_records(app: AppHandle) -> Result<Vec<PurchaseRecord>, String> {
    let conn = get_db_connection(&app)?;
    db::get_purchase_records(&conn)
        .map_err(|error| format!("No se pudo cargar los registros de compra: {error}"))
}

#[tauri::command]
fn add_purchase_record(
    app: AppHandle,
    expense_type: String,
    vehicle_folder_path: String,
    vehicle_name: String,
    plate: String,
    supplier_name: String,
    purchase_date: String,
    purchase_price: f64,
    invoice_number: String,
    payment_method: String,
    notes: String,
    source_file: String,
) -> Result<PurchaseRecord, String> {
    if invoice_number.trim().is_empty() {
        return Err("El numero de factura es obligatorio para registrar una compra.".to_string());
    }
    let conn = get_db_connection(&app)?;
    db::add_purchase_record(
        &conn,
        &expense_type,
        &vehicle_folder_path,
        &vehicle_name,
        &plate,
        &supplier_name,
        &purchase_date,
        purchase_price,
        &invoice_number,
        &payment_method,
        &notes,
        &source_file,
    )
    .map_err(|error| format!("No se pudo registrar la compra: {error}"))
}

#[tauri::command]
fn delete_purchase_record(app: AppHandle, record_id: u64) -> Result<(), String> {
    let conn = get_db_connection(&app)?;
    db::delete_purchase_record(&conn, record_id)
        .map_err(|error| format!("No se pudo eliminar el registro de compra: {error}"))
}

#[derive(Debug, Serialize)]
struct VehiclePhoto {
    file_name: String,
    data_url: String,
}

#[tauri::command]
fn list_vehicle_photos(app: AppHandle, folder_path: String) -> Result<Vec<VehiclePhoto>, String> {
    let folder = validate_vehicle_folder(&app, &folder_path)?;

    let mut photos = Vec::new();
    let entries = fs::read_dir(&folder)
        .map_err(|e| format!("No se pudo leer la carpeta: {e}"))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path.extension().and_then(|v| v.to_str()).unwrap_or("").to_lowercase();
        if matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "webp") {
            let bytes = fs::read(&path)
                .map_err(|e| format!("No se pudo leer la imagen: {e}"))?;
            let mime = match ext.as_str() {
                "png" => "image/png",
                "webp" => "image/webp",
                _ => "image/jpeg",
            };
            let file_name = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();
            photos.push(VehiclePhoto {
                file_name,
                data_url: format!("data:{};base64,{}", mime, STANDARD.encode(&bytes)),
            });
        }
    }

    photos.sort_by(|a, b| a.file_name.to_lowercase().cmp(&b.file_name.to_lowercase()));
    Ok(photos)
}

#[tauri::command]
fn save_vehicle_photo(app: AppHandle, folder_path: String, photo_data: String, file_name: String) -> Result<(), String> {
    let folder = validate_vehicle_folder(&app, &folder_path)?;

    // Validate file_name to prevent path traversal
    if file_name.contains('/') || file_name.contains('\\') || file_name.contains("..") {
        return Err("Nombre de archivo no válido.".to_string());
    }

    // Validate file extension
    let allowed_extensions = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];
    let has_valid_ext = file_name.rsplit('.').next()
        .map(|ext| allowed_extensions.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false);
    if !has_valid_ext {
        return Err("Extensión de archivo no permitida. Use: jpg, jpeg, png, webp, gif, bmp.".to_string());
    }

    // photo_data is base64 with data URI prefix
    let base64_data = photo_data
        .split(',')
        .nth(1)
        .unwrap_or(&photo_data);

    let bytes = STANDARD.decode(base64_data)
        .map_err(|e| format!("No se pudo decodificar la imagen: {e}"))?;

    // Limit file size to 10MB
    if bytes.len() > 10 * 1024 * 1024 {
        return Err("La imagen excede el tamaño máximo de 10MB.".to_string());
    }

    let dest = folder.join(&file_name);
    fs::write(&dest, &bytes)
        .map_err(|e| format!("No se pudo guardar la imagen: {e}"))?;

    Ok(())
}

#[tauri::command]
fn delete_vehicle_photo(app: AppHandle, folder_path: String, file_name: String) -> Result<(), String> {
    // Validate file_name to prevent path traversal
    if file_name.contains('/') || file_name.contains('\\') || file_name.contains("..") {
        return Err("Nombre de archivo no válido.".to_string());
    }

    let folder = validate_vehicle_folder(&app, &folder_path)?;
    let path = folder.join(&file_name);
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("No se pudo eliminar la foto: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
fn login(app: AppHandle, username: String, password: String) -> Result<LoginResult, String> {
    let conn = get_db_connection(&app)?;
    db::authenticate_user(&conn, &username, &password)
        .map_err(|e| format!("Error de autenticacion: {}", e))?
        .ok_or_else(|| "Usuario o contrasena incorrectos.".to_string())
}

#[tauri::command]
fn import_csv_file(app: AppHandle, file_path: String, import_type: String) -> Result<ImportReport, String> {
    let import_type = import_type.to_lowercase();

    match import_type.as_str() {
        "stock" => {
            let (stock_records, mut errors) = importer::parse_stock_csv(&file_path)?;
            let total_records = stock_records.len();

            // Get stock folder for creating vehicle directories
            let stock_dir = app_stock_dir(&app)?;

            let mut imported_count = 0;
            for record in stock_records {
                if record.modelo.trim().is_empty() {
                    continue;
                }

                // Create vehicle folder with sanitized path
                let safe_name = sanitize_vehicle_name(&record.modelo)
                    .unwrap_or_else(|_| record.modelo.clone());
                let vehicle_path = match ensure_unique_vehicle_path(&stock_dir, &safe_name, None) {
                    Ok(path) => path,
                    Err(e) => {
                        errors.push(format!("Error al crear ruta para '{}': {}", record.modelo, e));
                        continue;
                    }
                };

                // Create vehicle folder
                if let Err(e) = fs::create_dir_all(&vehicle_path) {
                    errors.push(format!("No se pudo crear carpeta '{}': {}", record.modelo, e));
                    continue;
                }

                imported_count += 1;
            }

            Ok(ImportReport {
                file_name: std::path::Path::new(&file_path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string(),
                records_processed: total_records,
                records_imported: imported_count,
                errors,
            })
        },
        "sales" => {
            let (sales_records, errors) = importer::parse_sales_csv(&file_path)?;

            // For now, just report what was found
            // Full integration would map vehicle names to folder paths and create SalesRecords

            Ok(ImportReport {
                file_name: std::path::Path::new(&file_path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string(),
                records_processed: sales_records.len(),
                records_imported: 0, // Requires manual linking of vehicle names
                errors,
            })
        },
        _ => Err(format!("Tipo de importación no reconocido: {}", import_type))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_app_state,
            list_sales_history,
            list_fiscal_entries,
            list_gastos_entries,
            list_leads,
            list_clients,
            get_vehicle_ad,
            get_stock_folder_path,
            create_vehicle,
            rename_vehicle,
            delete_vehicle,
            create_lead,
            update_lead,
            delete_lead,
            create_client,
            update_client,
            delete_client,
            convert_lead_to_client,
            export_app_data,
            set_vehicle_ad,
            open_folder,
            open_external,
            get_vehicle_thumbnail,
            list_vehicle_photos,
            save_vehicle_photo,
            delete_vehicle_photo,
            get_lead_notes,
            add_lead_note,
            delete_lead_note,
            get_sales_records,
            add_sales_record,
            delete_sales_record,
            get_purchase_records,
            add_purchase_record,
            delete_purchase_record,
            login,
            import_csv_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{
        backup_timestamp_token, build_client, build_lead, ensure_unique_vehicle_path,
        folder_node_from_path, legacy_dir_from_docs_legacy, legacy_entry_node_from_path,
        sales_parent_dirs_from_docs_legacy, sanitize_contact_name, sanitize_optional_path,
        sanitize_vehicle_name, stock_vehicle_from_path, write_backup_bundle, ClientInput,
        LeadInput, VehicleAdInfo,
    };
    use std::{
        fs,
        path::PathBuf,
        time::{Duration, UNIX_EPOCH},
    };
    use tempfile::tempdir;

    #[test]
    fn sanitize_vehicle_name_rejects_empty_input() {
        let error = sanitize_vehicle_name("   ").unwrap_err();
        assert!(error.contains("vacío"));
    }

    #[test]
    fn sanitize_vehicle_name_replaces_invalid_characters_and_collapses_spaces() {
        let sanitized = sanitize_vehicle_name(r#"  SEAT\IBIZA/:*?"<>|  4168LNZ  "#).unwrap();
        assert_eq!(sanitized, "SEAT IBIZA 4168LNZ");
    }

    #[test]
    fn sanitize_vehicle_name_keeps_valid_name() {
        let sanitized = sanitize_vehicle_name("SEAT IBIZA 4168LNZ").unwrap();
        assert_eq!(sanitized, "SEAT IBIZA 4168LNZ");
    }

    #[test]
    fn sanitize_vehicle_name_trims_spaces_and_dots() {
        let sanitized = sanitize_vehicle_name("  ..SEAT IBIZA 4168LNZ..  ").unwrap();
        assert_eq!(sanitized, "SEAT IBIZA 4168LNZ");
    }

    #[test]
    fn sanitize_vehicle_name_limits_length_to_eighty_characters() {
        let input = format!("{}{}", "A".repeat(79), "BCDEFG");
        let sanitized = sanitize_vehicle_name(&input).unwrap();
        assert_eq!(sanitized, format!("{}B", "A".repeat(79)));
    }

    #[test]
    fn sanitize_vehicle_name_rejects_only_invalid_characters() {
        let error = sanitize_vehicle_name(r#" \ / : * ? " < > | "#).unwrap_err();
        assert!(error.contains("válido"));
    }

    #[test]
    fn ensure_unique_vehicle_path_returns_base_path_when_available() {
        let stock_dir = tempdir().unwrap();
        let path = ensure_unique_vehicle_path(stock_dir.path(), "Coche", None).unwrap();
        assert_eq!(path, stock_dir.path().join("Coche"));
    }

    #[test]
    fn ensure_unique_vehicle_path_adds_suffix_when_folder_exists() {
        let stock_dir = tempdir().unwrap();
        fs::create_dir(stock_dir.path().join("Coche")).unwrap();

        let path = ensure_unique_vehicle_path(stock_dir.path(), "Coche", None).unwrap();
        assert_eq!(path, stock_dir.path().join("Coche (2)"));
    }

    #[test]
    fn ensure_unique_vehicle_path_returns_same_path_for_current_folder() {
        let stock_dir = tempdir().unwrap();
        let current_path = stock_dir.path().join("Coche");
        fs::create_dir(&current_path).unwrap();

        let path =
            ensure_unique_vehicle_path(stock_dir.path(), "Coche", Some(&current_path)).unwrap();
        assert_eq!(path, current_path);
    }

    #[test]
    fn stock_vehicle_from_path_returns_name_and_path() {
        let path = PathBuf::from("any").join("SEAT IBIZA");
        let vehicle = stock_vehicle_from_path(&path).unwrap();

        assert_eq!(vehicle.name, "SEAT IBIZA");
        assert_eq!(vehicle.folder_path, path.to_string_lossy());
    }

    #[test]
    fn stock_vehicle_from_path_rejects_empty_name() {
        let path = PathBuf::from("   ");
        let error = stock_vehicle_from_path(&path).unwrap_err();
        assert!(error.contains("No se pudo obtener el nombre"));
    }

    #[test]
    fn stock_vehicle_from_path_rejects_missing_file_name() {
        let path = PathBuf::new();
        let error = stock_vehicle_from_path(&path).unwrap_err();
        assert!(error.contains("No se pudo obtener el nombre"));
    }

    #[test]
    fn sanitize_contact_name_rejects_empty_values() {
        let error = sanitize_contact_name("   ").unwrap_err();
        assert!(error.contains("vacío"));
    }

    #[test]
    fn build_lead_trims_contact_fields() {
        let lead = build_lead(
            1,
            LeadInput {
                name: "  Mario   Lopez ".to_string(),
                phone: " 600 123 123 ".to_string(),
                email: " mario@example.com ".to_string(),
                notes: "  Quiere financiar ".to_string(),
                vehicle_interest: "  Seat Ibiza ".to_string(),
                vehicle_folder_path: Some(" stock/seat ".to_string()),
                estado: None,
                fecha_contacto: None,
                canal: None,
            },
            None,
        )
        .unwrap();

        assert_eq!(lead.name, "Mario Lopez");
        assert_eq!(lead.phone, "600 123 123");
        assert_eq!(lead.vehicle_interest, "Seat Ibiza");
        assert_eq!(lead.vehicle_folder_path, Some("stock/seat".to_string()));
    }

    #[test]
    fn build_client_can_link_source_lead() {
        let client = build_client(
            4,
            ClientInput {
                name: "Ana Perez".to_string(),
                phone: "611".to_string(),
                email: "".to_string(),
                dni: "12345678A".to_string(),
                notes: "Compra cerrada".to_string(),
                vehicle_folder_path: Some(" stock/ibiza ".to_string()),
            },
            Some(9),
        )
        .unwrap();

        assert_eq!(client.source_lead_id, Some(9));
        assert_eq!(client.dni, "12345678A");
        assert_eq!(client.vehicle_folder_path, Some("stock/ibiza".to_string()));
    }

    #[test]
    fn sales_parent_dirs_from_docs_legacy_only_returns_existing_known_containers() {
        let docs_dir = tempdir().unwrap();
        let ventas_parent = docs_dir.path().join("CODINACARS PC");
        fs::create_dir(&ventas_parent).unwrap();

        let parents = sales_parent_dirs_from_docs_legacy(docs_dir.path());
        assert_eq!(parents, vec![ventas_parent]);
    }

    #[test]
    fn legacy_dir_from_docs_legacy_matches_expected_directory_case_insensitively() {
        let docs_dir = tempdir().unwrap();
        let fiscal_dir = docs_dir.path().join("Fiscal");
        fs::create_dir(&fiscal_dir).unwrap();

        let found = legacy_dir_from_docs_legacy(docs_dir.path(), &["FISCAL"]).unwrap();
        assert_eq!(found, fiscal_dir);
    }

    #[test]
    fn folder_node_from_path_builds_nested_directory_tree() {
        let root = tempdir().unwrap();
        let year_dir = root.path().join("VENTAS 2026");
        let month_dir = year_dir.join("2. FEBRERO");
        let sale_dir = month_dir.join("SEAT LEON 1112MVR");
        fs::create_dir_all(&sale_dir).unwrap();

        let node = folder_node_from_path(&year_dir, 2).unwrap();
        assert_eq!(node.name, "VENTAS 2026");
        assert_eq!(node.children.len(), 1);
        assert_eq!(node.children[0].name, "2. FEBRERO");
        assert_eq!(node.children[0].children[0].name, "SEAT LEON 1112MVR");
    }

    #[test]
    fn legacy_entry_node_from_path_marks_files_and_opens_parent_folder() {
        let root = tempdir().unwrap();
        let file_path = root.path().join("IAE 2026.pdf");
        fs::write(&file_path, "pdf").unwrap();

        let node = legacy_entry_node_from_path(&file_path, 0).unwrap();
        assert_eq!(node.name, "IAE 2026.pdf");
        assert!(!node.is_dir);
        assert!(node.children.is_empty());
        assert_eq!(node.open_path, root.path().to_string_lossy().to_string());
    }

    #[test]
    fn sanitize_optional_path_returns_none_for_blank_values() {
        assert_eq!(sanitize_optional_path(Some("   ".to_string())), None);
    }

    #[test]
    fn vehicle_ad_info_can_be_empty_and_default() {
        let ad_info = VehicleAdInfo::default();
        assert!(ad_info.url.is_empty());
        assert!(ad_info.status.is_empty());
        assert!(ad_info.date.is_empty());
    }

    #[test]
    fn backup_timestamp_token_uses_epoch_millis() {
        let timestamp = backup_timestamp_token(UNIX_EPOCH + Duration::from_millis(1_234)).unwrap();
        assert_eq!(timestamp, "1234");
    }

    #[test]
    fn write_backup_bundle_copies_json_files_and_manifest() {
        let source_dir = tempdir().unwrap();
        let backups_dir = tempdir().unwrap();
        fs::write(source_dir.path().join("leads.json"), "[{\"id\":1}]").unwrap();
        fs::write(source_dir.path().join("clients.json"), "[{\"id\":2}]").unwrap();

        let export =
            write_backup_bundle(source_dir.path(), backups_dir.path(), "0.1.0", "1234").unwrap();
        let export_dir = PathBuf::from(&export.export_path);

        assert_eq!(
            fs::read_to_string(export_dir.join("leads.json")).unwrap(),
            "[{\"id\":1}]"
        );
        assert_eq!(
            fs::read_to_string(export_dir.join("clients.json")).unwrap(),
            "[{\"id\":2}]"
        );
        assert_eq!(
            fs::read_to_string(export_dir.join("vehicle_ads.json")).unwrap(),
            "[]"
        );

        let manifest = fs::read_to_string(export_dir.join("manifest.json")).unwrap();
        assert!(manifest.contains("\"app_version\": \"0.1.0\""));
        assert!(manifest.contains("\"exported_at\": \"1234\""));
        assert!(manifest.contains("\"vehicle_ads.json\""));
    }
}
